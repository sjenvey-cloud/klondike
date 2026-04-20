package com.cardgames.server.friends;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendRequestRepository extends JpaRepository<FriendRequest, Integer> {

    List<FriendRequest> findByRequesteeId(int requesteeId);

    List<FriendRequest> findByRequesterId(int requesterId);

    Optional<FriendRequest> findByRequesterIdAndRequesteeId(int requesterId, int requesteeId);

    boolean existsByRequesterIdAndRequesteeId(int requesterId, int requesteeId);
}
