package com.cardgames.server.challenges;

import java.util.UUID;

/** DEV-160: POST /api/v1/challenges body */
public record CreateChallengeRequest(
    UUID sessionUuid,
    int challengedUserId
) {}
