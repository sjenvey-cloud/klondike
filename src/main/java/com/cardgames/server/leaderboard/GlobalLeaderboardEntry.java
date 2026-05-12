package com.cardgames.server.leaderboard;

import java.util.UUID;

/**
 * DEV-222 / DEV-224: One row in the global leaderboard.
 * Represents the best ranked win for a given user within the requested period,
 * draw mode, and sort criterion.
 */
public record GlobalLeaderboardEntry(
    int    rank,
    UUID   userUuid,
    String displayName,
    int    moves,
    int    timeSeconds
) {}
