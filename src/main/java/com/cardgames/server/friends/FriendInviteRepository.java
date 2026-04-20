package com.cardgames.server.friends;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface FriendInviteRepository extends JpaRepository<FriendInvite, Integer> {

    Optional<FriendInvite> findByToken(String token);

    /** Pending (not yet accepted, not expired) invites created by a user, newest first. */
    List<FriendInvite> findByInviterIdAndAcceptedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
            int inviterId, LocalDateTime now);
}
