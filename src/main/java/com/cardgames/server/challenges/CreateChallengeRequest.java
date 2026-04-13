package com.cardgames.server.challenges;

/** DEV-160: POST /api/v1/challenges body */
public record CreateChallengeRequest(
    int sessionId,
    int challengedUserId
) {}
