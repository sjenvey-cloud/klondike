package com.cardgames.server.hand;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface HandRepository extends JpaRepository<Hand, Integer> {

    // DEV-209: look up by public UUID (used in URL path params and request bodies)
    Optional<Hand> findByUuid(UUID uuid);

    Optional<Hand> findByShuffleSeed(long shuffleSeed);

    /**
     * Find hands that have been won by at least {@code minWinners} distinct users for
     * the given draw mode and have never been used as a daily challenge.
     *
     * Requiring multiple winners (minWinners >= 2) gives a meaningful quality signal:
     *  - The hand is definitely winnable (multiple people completed it).
     *  - It is unlikely to be trivially easy or impossibly hard.
     *
     * Pass minWinners=1 as a fallback when the library is still small and not enough
     * hands have 2+ solvers yet.
     *
     * LIMIT 1 is sufficient because the caller only uses the first result, and
     * ORDER BY RANDOM() with LIMIT 1 avoids generating random values for every
     * qualifying row in larger tables.
     */
    @Query(value = """
            SELECT h.* FROM hands h
            WHERE h.draw_mode = :drawMode
              AND (
                  SELECT COUNT(DISTINCT s.user_id) FROM sessions s
                  WHERE s.hand_id = h.id AND s.status = 'won' AND s.draw_mode = :drawMode
              ) >= :minWinners
              AND NOT EXISTS (
                  SELECT 1 FROM daily_challenges dc
                  WHERE dc.hand_id = h.id AND dc.draw_mode = :drawMode
              )
            ORDER BY RANDOM()
            LIMIT 1
            """, nativeQuery = true)
    List<Hand> findEligibleDailyHands(@Param("drawMode") String drawMode,
                                       @Param("minWinners") int minWinners);
}
