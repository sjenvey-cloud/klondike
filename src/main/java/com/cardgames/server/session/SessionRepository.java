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

    // DEV-99: history grouped by day in the user's local timezone
    // tzOffset = minutes east of UTC (added to stored UTC times before grouping)
    @Query(value =
        "SELECT CAST(s.started_at + :tzOffset * INTERVAL '1 minute' AS date) AS day, " +
        "COUNT(s.id), " +
        "SUM(CASE WHEN s.status = 'won' THEN 1 ELSE 0 END) " +
        "FROM sessions s " +
        "WHERE s.user_id = :userId AND s.started_at >= :since " +
        "GROUP BY CAST(s.started_at + :tzOffset * INTERVAL '1 minute' AS date) " +
        "ORDER BY CAST(s.started_at + :tzOffset * INTERVAL '1 minute' AS date) ASC",
        nativeQuery = true)
    List<Object[]> findDailyHistory(
        @Param("userId") int userId,
        @Param("since") LocalDateTime since,
        @Param("tzOffset") int tzOffset);

    // DEV-100: sessions for a specific calendar day, most recent first
    @Query("SELECT s FROM Session s WHERE s.userId = :userId AND s.startedAt >= :from AND s.startedAt < :to ORDER BY s.startedAt DESC")
    List<Session> findByUserIdAndStartedAtBetween(
        @Param("userId") int userId, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    // DEV-150: stats grouped by draw_mode
    @Query("SELECT s.drawMode, COUNT(s.id), " +
           "SUM(CASE WHEN s.status = 'won' THEN 1 ELSE 0 END), " +
           "AVG(CASE WHEN s.status = 'won' THEN CAST(s.moves AS double) ELSE NULL END), " +
           "AVG(CASE WHEN s.status = 'won' THEN CAST(s.timeSeconds AS double) ELSE NULL END) " +
           "FROM Session s WHERE s.userId = :userId GROUP BY s.drawMode")
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

    // DEV-164: league — wins + best moves for a set of userIds within a time window
    @Query("SELECT s.userId, COUNT(s.id), MIN(CASE WHEN s.status = 'won' THEN s.moves ELSE NULL END) " +
           "FROM Session s WHERE s.userId IN :userIds AND s.status = 'won' " +
           "AND s.completedAt >= :since " +
           "GROUP BY s.userId")
    List<Object[]> findLeagueStats(@Param("userIds") List<Integer> userIds,
                                   @Param("since") LocalDateTime since);
}
