package com.cardgames.server.challenges;

import java.time.LocalDateTime;

/** DEV-161: one inbox entry */
public record InboxEntry(
    int           challengeId,
    int           challengerUserId,
    String        challengerDisplayName,
    int           handId,
    int           moves,
    int           timeSeconds,
    LocalDateTime createdAt
) {}
