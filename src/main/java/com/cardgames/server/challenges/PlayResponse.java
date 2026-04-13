package com.cardgames.server.challenges;

/** DEV-162: response after accepting a challenge — enough to start the game client-side */
public record PlayResponse(
    int    sessionId,
    int    handId,
    long   shuffleSeed,
    int[]  cards,
    String drawMode
) {}
