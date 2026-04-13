package com.cardgames.server.league;

/** DEV-164: one row in the friend league table */
public record LeagueEntry(
    int    rank,
    int    userId,
    String displayName,
    int    wins,
    Integer bestMoves   // null if no wins
) {}
