package com.cardgames.server.hand;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface HandRepository extends JpaRepository<Hand, Integer> {
    Optional<Hand> findByShuffleSeed(long shuffleSeed);
}
