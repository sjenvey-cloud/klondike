package com.cardgames.server.challenges;

import java.time.LocalDateTime;
import java.util.UUID;

/** DEV-160: response after creating a challenge */
public record ChallengeResponse(
    int           challengeId,
    UUID          handUuid,
    int           challengedUserId,
    String        status,
    LocalDateTime createdAt
) {}
