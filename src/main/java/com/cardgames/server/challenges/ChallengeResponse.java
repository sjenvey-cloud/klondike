package com.cardgames.server.challenges;

import java.time.LocalDateTime;

/** DEV-160: response after creating a challenge */
public record ChallengeResponse(
    int           challengeId,
    int           handId,
    int           challengedUserId,
    String        status,
    LocalDateTime createdAt
) {}
