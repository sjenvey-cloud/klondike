package com.cardgames.server.session;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface SessionRepository extends JpaRepository<Session, Integer> {

    // DEV-209: look up by public UUID (used in URL path params and request bodies)
    java.util.Optional<Session> findByUuid(UUID uuid);

    // DEV-202: most recent active session for a user — daily and random tracked separately
    // so both can be resumed independently (daily on /daily, random on /game).
    java.util.Optional<Session> findFirstByUserIdAndStatusAndIsDailyTrueOrderByStartedAtDesc(int userId, String status);
    java.util.Optional<Session> findFirstByUserIdAndStatusAndIsDailyFalseOrderByStartedAtDesc(int userId, String status);

    // DEV-106: ranked daily attempt check
    boolean existsByUserIdAndDailyDateAndDrawModeAndIsRankedTrueAndStatusIn(
        int userId, LocalDate dailyDate, String drawMode, String[] statuses);

    // Social challenge: check if a user has won a specific hand
    boolean existsByUserIdAndHandIdAndStatus(int userId, int handId, String status);

    // Daily leaderboard (top 50 ranked wins for a date+mode)
    @Query("SELECT s FROM Session s WHERE s.isDaily = true AND s.dailyDate = :date " +
           "AND s.drawMode = :drawMode AND s.isRanked = true AND s.status = 'won' " +
           "ORDER BY s.moves ASC, s.timeSeconds ASC")
    List<Session> findDailyLeaderboard(
        @Param("date") LocalDate date, @Param("drawMode") String drawMode);

    // Retroactively mark all won sessions for a hand as daily when it is selected as today's challenge
    @Modifying
    @Query("UPDATE Session s SET s.isDaily = true, s.dailyDate = :date " +
           "WHERE s.handId = :handId AND s.status = 'won'")
    int markWonSessionsAsDaily(@Param("handId") int handId, @Param("date") LocalDate date);

    // Demote prior abandoned ranked sessions before recording a new ranked win.
    // The unique constraint idx_one_ranked_daily covers (user_id, daily_date, draw_mode)
    // WHERE is_ranked=true AND status IN ('won','abandoned'). When a user abandons their
    // first ranked attempt and then wins a subsequent one, the old abandoned row must be
    // demoted to is_ranked=false so the constraint allows the new won row.
    @Modifying
    @Query("UPDATE Session s SET s.isRanked = false " +
           "WHERE s.userId = :userId AND s.dailyDate = :date AND s.drawMode = :drawMode " +
           "AND s.isRanked = true AND s.status = 'abandoned' AND s.id != :excludeId")
    int demoteAbandonedRankedSessions(
        @Param("userId") int userId,
        @Param("date") LocalDate date,
        @Param("drawMode") String drawMode,
        @Param("excludeId") int excludeId);

    // DEV-99: history grouped by day in the user's local timezone — unique hands only.
    // Each hand_id counts once, attributed to the day it was last played.
    // tzOffset = minutes east of UTC (added to stored UTC times before grouping).
    // Daily-challenge sessions are excluded (daily_date IS NULL) so they don't
    // pollute the profile activity calendar.
    //
    // Wrapped in a second subquery so GROUP BY / ORDER BY reference the computed
    // 'day' alias rather than repeating the CAST expression with a separate '?'
    // binding — PostgreSQL strict-GROUP-BY rejects repeated non-identical parameters.
    @Query(value =
        "SELECT day, COUNT(*) AS played, SUM(CASE WHEN has_won = 1 THEN 1 ELSE 0 END) AS won " +
        "FROM (" +
        "  SELECT CAST(last_played + :tzOffset * INTERVAL '1 minute' AS date) AS day, has_won " +
        "  FROM (" +
        "    SELECT hand_id, " +
        "      MAX(started_at) AS last_played, " +
        "      MAX(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS has_won " +
        "    FROM sessions " +
        "    WHERE user_id = :userId AND daily_date IS NULL " +
        "    GROUP BY hand_id" +
        "  ) inner_t " +
        "  WHERE last_played >= :since" +
        ") outer_t " +
        "GROUP BY day " +
        "ORDER BY day ASC",
        nativeQuery = true)
    List<Object[]> findDailyHistory(
        @Param("userId") int userId,
        @Param("since") LocalDateTime since,
        @Param("tzOffset") int tzOffset);

    // Daily calendar — sessions played as a genuine daily challenge for a set of hand IDs.
    // dailyDate IS NOT NULL is the reliable test: it is only populated when the session
    // was created through the daily challenge flow.
    @Query("SELECT s FROM Session s WHERE s.userId = :userId AND s.handId IN :handIds AND s.dailyDate IS NOT NULL")
    List<Session> findDailySessionsByUserIdAndHandIdIn(
        @Param("userId") int userId,
        @Param("handIds") List<Integer> handIds);

    // DEV-100: non-daily sessions for a specific calendar day.
    // Daily challenges are excluded — they have their own calendar on the daily screen.
    // Won sessions sort first so putIfAbsent deduplication (by hand) always keeps the win
    // even if the user redealt and abandoned the same hand later the same day.
    @Query("SELECT s FROM Session s WHERE s.userId = :userId AND s.isDaily = false AND s.startedAt >= :from AND s.startedAt < :to ORDER BY CASE WHEN s.status = 'won' THEN 0 ELSE 1 END ASC, s.startedAt DESC")
    List<Session> findByUserIdAndStartedAtBetween(
        @Param("userId") int userId, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    // DEV-150: stats grouped by draw_mode — unique hands only.
    // Each hand_id counts once; wins/averages reflect the best won attempt per hand.
    @Query(value =
        "SELECT draw_mode, " +
        "COUNT(*) AS played, " +
        "SUM(CASE WHEN has_won = 1 THEN 1 ELSE 0 END) AS won, " +
        "AVG(CASE WHEN best_moves IS NOT NULL THEN CAST(best_moves AS double precision) END) AS avg_moves, " +
        "AVG(CASE WHEN best_time IS NOT NULL  THEN CAST(best_time  AS double precision) END) AS avg_time " +
        "FROM (" +
        "  SELECT hand_id, draw_mode, " +
        "    MAX(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS has_won, " +
        "    MIN(CASE WHEN status = 'won' THEN moves        END) AS best_moves, " +
        "    MIN(CASE WHEN status = 'won' THEN time_seconds END) AS best_time " +
        "  FROM sessions WHERE user_id = :userId GROUP BY hand_id, draw_mode" +
        ") t GROUP BY draw_mode",
        nativeQuery = true)
    List<Object[]> findStatsByDrawMode(@Param("userId") int userId);

    // DEV-151: personal best by fewest moves (won sessions only)
    @Query("SELECT s FROM Session s WHERE s.userId = :userId AND s.status = 'won' " +
           "ORDER BY s.moves ASC, s.timeSeconds ASC")
    List<Session> findTopWinByMoves(@Param("userId") int userId, org.springframework.data.domain.Pageable pageable);

    // DEV-151: personal best by fastest time (won sessions only)
    @Query("SELECT s FROM Session s WHERE s.userId = :userId AND s.status = 'won' " +
           "ORDER BY s.timeSeconds ASC, s.moves ASC")
    List<Session> findTopWinByTime(@Param("userId") int userId, org.springframework.data.domain.Pageable pageable);

    // Hand leaderboard — all won sessions for a specific hand, best per user
    @Query("SELECT s FROM Session s WHERE s.handId = :handId AND s.status = 'won' " +
           "ORDER BY s.moves ASC, s.timeSeconds ASC")
    List<Session> findWonSessionsByHandId(@Param("handId") int handId);

    // Daily leaderboard — best session per user for a specific hand+date, by moves.
    // Uses DISTINCT ON to select each user's fewest-move win across ALL their daily
    // sessions for this challenge (ranked first attempt AND unranked replays).
    // is_daily = true distinguishes daily-challenge sessions from random-hand plays
    // of the same physical hand; is_ranked is intentionally NOT filtered so that a
    // user who replays and beats their own time/moves gets credit for both metrics.
    @Query(value =
        "SELECT * FROM (" +
        "  SELECT DISTINCT ON (user_id) * FROM sessions " +
        "  WHERE hand_id = :handId AND daily_date = :date AND status = 'won' AND is_daily = true " +
        "  ORDER BY user_id, moves ASC, time_seconds ASC" +
        ") best ORDER BY moves ASC, time_seconds ASC LIMIT 50",
        nativeQuery = true)
    List<Session> findDailyWinsByHandForMoves(
        @Param("handId") int handId, @Param("date") LocalDate date);

    // Daily leaderboard — best session per user for a specific hand+date, by time.
    @Query(value =
        "SELECT * FROM (" +
        "  SELECT DISTINCT ON (user_id) * FROM sessions " +
        "  WHERE hand_id = :handId AND daily_date = :date AND status = 'won' AND is_daily = true " +
        "  ORDER BY user_id, time_seconds ASC, moves ASC" +
        ") best ORDER BY time_seconds ASC, moves ASC LIMIT 50",
        nativeQuery = true)
    List<Session> findDailyWinsByHandForTime(
        @Param("handId") int handId, @Param("date") LocalDate date);

    // Debug: count sessions for a hand — all statuses, no date/ranked filter
    @Query(value = "SELECT COUNT(*) FROM sessions WHERE hand_id = :handId", nativeQuery = true)
    long countByHandId(@Param("handId") int handId);

    // Debug: count sessions for a hand+date — all statuses and ranked values
    @Query(value = "SELECT COUNT(*) FROM sessions WHERE hand_id = :handId AND daily_date = :date", nativeQuery = true)
    long countByHandIdAndDate(@Param("handId") int handId, @Param("date") LocalDate date);

    // Calendar user-status: all sessions for a user across a set of hand IDs
    @Query("SELECT s FROM Session s WHERE s.userId = :userId AND s.handId IN :handIds")
    List<Session> findByUserIdAndHandIdIn(
        @Param("userId") int userId,
        @Param("handIds") List<Integer> handIds);

    // ── DEV-222: Global leaderboard ────────────────────────────────────────
    // One row per user (their best won ranked session) using PostgreSQL DISTINCT ON.
    // The inner subquery picks the best session per user in the defined order; the
    // outer query re-sorts that result set globally and applies the LIMIT.

    @Query(value =
        "SELECT * FROM (" +
        "  SELECT DISTINCT ON (user_id) * FROM sessions " +
        "  WHERE draw_mode = :drawMode AND is_ranked = true AND status = 'won' " +
        "    AND completed_at >= :since " +
        "  ORDER BY user_id, moves ASC, time_seconds ASC" +
        ") best ORDER BY moves ASC, time_seconds ASC LIMIT 50",
        nativeQuery = true)
    List<Session> findGlobalLeaderboardByMoves(
        @Param("drawMode") String drawMode, @Param("since") LocalDateTime since);

    @Query(value =
        "SELECT * FROM (" +
        "  SELECT DISTINCT ON (user_id) * FROM sessions " +
        "  WHERE draw_mode = :drawMode AND is_ranked = true AND status = 'won' " +
        "    AND completed_at >= :since " +
        "  ORDER BY user_id, time_seconds ASC, moves ASC" +
        ") best ORDER BY time_seconds ASC, moves ASC LIMIT 50",
        nativeQuery = true)
    List<Session> findGlobalLeaderboardByTime(
        @Param("drawMode") String drawMode, @Param("since") LocalDateTime since);

    // ── DEV-224: Rank computation ──────────────────────────────────────────
    // Step 1 — fetch the user's best qualifying session for the period+sort.

    @Query(value =
        "SELECT * FROM sessions WHERE user_id = :userId AND draw_mode = :drawMode " +
        "AND is_ranked = true AND status = 'won' AND completed_at >= :since " +
        "ORDER BY moves ASC, time_seconds ASC LIMIT 1",
        nativeQuery = true)
    java.util.Optional<Session> findBestSessionByMoves(
        @Param("userId") int userId, @Param("drawMode") String drawMode,
        @Param("since") LocalDateTime since);

    @Query(value =
        "SELECT * FROM sessions WHERE user_id = :userId AND draw_mode = :drawMode " +
        "AND is_ranked = true AND status = 'won' AND completed_at >= :since " +
        "ORDER BY time_seconds ASC, moves ASC LIMIT 1",
        nativeQuery = true)
    java.util.Optional<Session> findBestSessionByTime(
        @Param("userId") int userId, @Param("drawMode") String drawMode,
        @Param("since") LocalDateTime since);

    // Step 2 — count how many distinct users have a strictly better best session.
    // rank = count + 1.

    @Query(value =
        "SELECT COUNT(*) FROM (" +
        "  SELECT DISTINCT ON (user_id) moves, time_seconds FROM sessions " +
        "  WHERE draw_mode = :drawMode AND is_ranked = true AND status = 'won' " +
        "    AND completed_at >= :since " +
        "  ORDER BY user_id, moves ASC, time_seconds ASC" +
        ") best WHERE moves < :myMoves OR (moves = :myMoves AND time_seconds < :myTime)",
        nativeQuery = true)
    long countUsersRankedAboveByMoves(
        @Param("drawMode") String drawMode, @Param("since") LocalDateTime since,
        @Param("myMoves") int myMoves, @Param("myTime") int myTime);

    @Query(value =
        "SELECT COUNT(*) FROM (" +
        "  SELECT DISTINCT ON (user_id) moves, time_seconds FROM sessions " +
        "  WHERE draw_mode = :drawMode AND is_ranked = true AND status = 'won' " +
        "    AND completed_at >= :since " +
        "  ORDER BY user_id, time_seconds ASC, moves ASC" +
        ") best WHERE time_seconds < :myTime OR (time_seconds = :myTime AND moves < :myMoves)",
        nativeQuery = true)
    long countUsersRankedAboveByTime(
        @Param("drawMode") String drawMode, @Param("since") LocalDateTime since,
        @Param("myTime") int myTime, @Param("myMoves") int myMoves);

    // DEV-164: league — wins + best moves for a set of userIds within a time window
    @Query("SELECT s.userId, COUNT(s.id), MIN(CASE WHEN s.status = 'won' THEN s.moves ELSE NULL END) " +
           "FROM Session s WHERE s.userId IN :userIds AND s.status = 'won' " +
           "AND s.completedAt >= :since " +
           "GROUP BY s.userId")
    List<Object[]> findLeagueStats(@Param("userIds") List<Integer> userIds,
                                   @Param("since") LocalDateTime since);
}
