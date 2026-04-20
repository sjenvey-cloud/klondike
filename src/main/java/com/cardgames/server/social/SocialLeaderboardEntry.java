package com.cardgames.server.social;

/**
 * One row in the social challenge leaderboard.
 * rank = 0 means the player has not yet won the hand.
 */
public record SocialLeaderboardEntry(
    int     rank,
    int     userId,
    String  displayName,
    boolean isCreator,
    Integer moves,
    Integer timeSeconds
) {}
