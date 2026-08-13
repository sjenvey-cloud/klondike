package com.cardgames.server.friends;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FriendAcceptanceRepository extends JpaRepository<FriendAcceptance, Integer> {

    List<FriendAcceptance> findByRequesterIdAndSeenFalseOrderByCreatedAtDesc(int requesterId);

    long countByRequesterIdAndSeenFalse(int requesterId);
}
