package com.cardgames.server.profile;

import java.time.LocalDateTime;

/** DEV-151: personal best sessions. */
public record RecordsResponse(
    PersonalBest fewestMoves,
    PersonalBest fastestTime
) {
    public record PersonalBest(
        int           sessionId,
        int           handId,
        String        drawMode,
        int           moves,
        int           timeSeconds,
        LocalDateTime completedAt
    ) {}
}
