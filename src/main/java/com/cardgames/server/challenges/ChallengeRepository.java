package com.cardgames.server.challenges;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChallengeRepository extends JpaRepository<Challenge, Integer> {

    // DEV-161: inbox — pending challenges sent to this user
    List<Challenge> findByChallengedUserIdAndStatus(int challengedUserId, String status);

    // DEV-163: look up challenge by the challenged player's session id
    Optional<Challenge> findByChallengedSessionId(int challengedSessionId);
}
