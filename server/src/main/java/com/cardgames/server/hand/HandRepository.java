package com.cardgames.server.hand;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface HandRepository extends JpaRepository<Hand, Integer> {
    // findById(Integer) provided by JpaRepository — returns Optional<Hand>
}
