package com.cardgames.server.hand;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HandRepository extends JpaRepository<Hand, Integer> {

    Optional<Hand> findByShuffleSeed(long shuffleSeed);

    /**
     * Find hands that have at least one won session for the given draw mode
     * and have never been used as a daily challenge.
     * Ordered randomly so each day a different one is selected.
     */
    @Query(value = """
            SELECT h.* FROM hands h
            WHERE h.draw_mode = :drawMode
              AND EXISTS (
                  SELECT 1 FROM sessions s
                  WHERE s.hand_id = h.id AND s.status = 'won' AND s.draw_mode = :drawMode
              )
              AND NOT EXISTS (
                  SELECT 1 FROM daily_challenges dc
                  WHERE dc.hand_id = h.id AND dc.draw_mode = :drawMode
              )
            ORDER BY RANDOM()
            """, nativeQuery = true)
    List<Hand> findEligibleDailyHands(@Param("drawMode") String drawMode);
}
