package com.cardgames.server.social;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SocialChallengeRepository extends JpaRepository<SocialChallenge, Integer> {

    @Query("SELECT c FROM SocialChallenge c WHERE c.creatorUserId = :userId ORDER BY c.createdAt DESC")
    List<SocialChallenge> findByCreatorUserId(@Param("userId") int userId);

    @Query("SELECT c FROM SocialChallenge c WHERE c.id IN " +
           "(SELECT p.challengeId FROM SocialChallengeParticipant p WHERE p.userId = :userId) " +
           "ORDER BY c.createdAt DESC")
    List<SocialChallenge> findChallengesWhereParticipant(@Param("userId") int userId);
}
