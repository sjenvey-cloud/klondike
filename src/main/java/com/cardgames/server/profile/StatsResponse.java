package com.cardgames.server.profile;

/** DEV-150: per-draw-mode session aggregates. */
public record StatsResponse(
    DrawModeStats draw1,
    DrawModeStats draw3
) {
    public record DrawModeStats(
        int    gamesPlayed,
        int    wins,
        double winRate,
        double avgMoves,
        double avgTimeSeconds
    ) {}

    public static final DrawModeStats EMPTY = new DrawModeStats(0, 0, 0.0, 0.0, 0.0);
}
