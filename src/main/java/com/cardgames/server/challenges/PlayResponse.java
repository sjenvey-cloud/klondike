package com.cardgames.server.challenges;

import java.util.UUID;

/** DEV-162: response after accepting a challenge — enough to start the game client-side */
public record PlayResponse(
    UUID   sessionUuid,
    UUID   handUuid,
    long   shuffleSeed,
    int[]  cards,
    String drawMode
) {}
