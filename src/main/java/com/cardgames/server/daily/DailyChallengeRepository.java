package com.cardgames.server.daily;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DailyChallengeRepository extends JpaRepository<DailyChallenge, Integer> {

    @Query("SELECT dc FROM DailyChallenge dc WHERE dc.challengeDate = :date AND dc.drawMode = :drawMode")
    Optional<DailyChallenge> findByDateAndMode(
        @Param("date") LocalDate date,
        @Param("drawMode") String drawMode);

    @Query("SELECT dc FROM DailyChallenge dc WHERE dc.drawMode = :drawMode " +
           "AND dc.challengeDate >= :since AND dc.challengeDate <= :until " +
           "ORDER BY dc.challengeDate DESC")
    List<DailyChallenge> findByDrawModeAndDateRange(
        @Param("drawMode") String drawMode,
        @Param("since") LocalDate since,
        @Param("until") LocalDate until);
}
