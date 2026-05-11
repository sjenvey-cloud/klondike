package com.cardgames.server.session;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SessionRepository extends JpaRepository<Session, Integer> {

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

    // DEV-99: history grouped by day in the user's local timezone — unique hands only.
    // Each hand_id counts once, attributed to the day it was last played.
    // tzOffset = minutes east of UTC (added to stored UTC times before grouping).
    // Daily-challenge sessions are excluded (is_daily IS NOT TRUE) so they don't
    // pollute the profile activity calendar.
    @Query(value =
        "SELECT CAST(last_played + :tzOffset * INTERVAL '1 minute' AS date) AS day, " +
        "COUNT(*) AS played, " +
        "SUM(CASE WHEN has_won = 1 THEN 1 ELSE 0 END) AS won " +
        "FROM (" +
        "  SELECT hand_id, " +
        "    MAX(started_at) AS last_played, " +
        "    MAX(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS has_won " +
        "  FROM sessions " +
        "  WHERE user_id = :userId AND daily_date IS NULL " +
        "  GROUP BY hand_id" +
        ") t " +
        "WHERE last_played >= :since " +
        "GROUP BY CAST(last_played + :tzOffset * INTERVAL '1 minute' AS date) " +
        "ORDER BY CAST(last_played + :tzOffset * INTERVAL '1 minute' AS date) ASC",
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

    // DEV-100: sessions for a specific calendar day, most recent first
    @Query("SELECT s FROM Session s WHERE s.userId = :userId AND s.startedAt >= :from AND s.startedAt < :to ORDER BY s.startedAt DESC")
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

    // Daily leaderboard by hand — only ranked wins where dailyDate matches.
    // dailyDate is only ever set when a session is created via the daily challenge
    // route (isDaily=true), so it is the reliable discriminator; avoiding s.isDaily
    // in JPQL removes any Hibernate boolean-accessor naming ambiguity.
    @Query("SELECT s FROM Session s WHERE s.handId = :handId " +
           "AND s.dailyDate = :date AND s.isRanked = true AND s.status = 'won' " +
           "ORDER BY s.moves ASC, s.timeSeconds ASC")
    List<Session> findRankedDailyWinsByHand(
        @Param("handId") int handId, @Param("date") LocalDate date);

    // Calendar user-status: all sessions for a user across a set of hand IDs
    @Query("SELECT s FROM Session s WHERE s.userId = :userId AND s.handId IN :handIds")
    List<Session> findByUserIdAndHandIdIn(
        @Param("userId") int userId,
        @Param("handIds") List<Integer> handIds);

    // DEV-164: league — wins + best moves for a set of userIds within a time window
    @Query("SELECT s.userId, COUNT(s.id), MIN(CASE WHEN s.status = 'won' THEN s.moves ELSE NULL END) " +
           "FROM Session s WHERE s.userId IN :userIds AND s.status = 'won' " +
           "AND s.completedAt >= :since " +
           "GROUP BY s.userId")
    List<Object[]> findLeagueStats(@Param("userIds") List<Integer> userIds,
                                   @Param("since") LocalDateTime since);
}
