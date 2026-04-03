package com.cardgames.server.session;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SessionRepository extends JpaRepository<Session, Integer> {
    // findById(Integer) provided by JpaRepository — returns Optional<Session>
}
