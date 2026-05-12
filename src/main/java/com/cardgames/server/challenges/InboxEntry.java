package com.cardgames.server.challenges;

import java.time.LocalDateTime;
import java.util.UUID;

/** DEV-161: one inbox entry */
public record InboxEntry(
    int           challengeId,
    UUID          challengerUserUuid,
    String        challengerDisplayName,
    UUID          handUuid,
    int           moves,
    int           timeSeconds,
    LocalDateTime createdAt
) {}
