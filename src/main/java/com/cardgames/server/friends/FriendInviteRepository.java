package com.cardgames.server.friends;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface FriendInviteRepository extends JpaRepository<FriendInvite, Integer> {
    Optional<FriendInvite> findByToken(String token);
}
