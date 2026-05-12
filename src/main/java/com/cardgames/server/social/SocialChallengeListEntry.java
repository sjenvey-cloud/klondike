package com.cardgames.server.social;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Summary entry used in the challenges list view.
 * userHasWon  — true if the authenticated user has a won session on this hand.
 * isCreator   — true if the authenticated user created this challenge.
 */
public record SocialChallengeListEntry(
    int           id,
    UUID          creatorUserUuid,
    String        creatorDisplayName,
    UUID          handUuid,
    String        drawMode,
    String        status,
    LocalDateTime createdAt,
    LocalDateTime endedAt,
    int           participantCount,
    int           winnerCount,
    boolean       userHasWon,
    boolean       isCreator
) {}
