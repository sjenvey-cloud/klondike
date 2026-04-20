package com.cardgames.server.social;

import java.time.LocalDateTime;

/**
 * Summary entry used in the challenges list view.
 * userHasWon  — true if the authenticated user has a won session on this hand.
 * isCreator   — true if the authenticated user created this challenge.
 */
public record SocialChallengeListEntry(
    int           id,
    int           creatorUserId,
    String        creatorDisplayName,
    int           handId,
    String        drawMode,
    String        status,
    LocalDateTime createdAt,
    LocalDateTime endedAt,
    int           participantCount,
    int           winnerCount,
    boolean       userHasWon,
    boolean       isCreator
) {}
