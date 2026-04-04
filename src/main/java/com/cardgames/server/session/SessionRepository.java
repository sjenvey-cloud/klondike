package com.cardgames.server.session;

import org.springframework.data.jpa.repository.JpaRepository;
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

    // DEV-99: history grouped by day
    @Query("SELECT CAST(s.startedAt AS date) as day, COUNT(s.id), " +
           "SUM(CASE WHEN s.status = 'won' THEN 1 ELSE 0 END) " +
           "FROM Session s WHERE s.userId = :userId AND s.startedAt >= :since " +
           "GROUP BY CAST(s.startedAt AS date) ORDER BY CAST(s.startedAt AS date) ASC")
    List<Object[]> findDailyHistory(@Param("userId") int userId, @Param("since") LocalDateTime since);

    // DEV-100: sessions for a specific calendar day
    List<Session> findByUserIdAndStartedAtBetween(int userId, LocalDateTime from, LocalDateTime to);
}
