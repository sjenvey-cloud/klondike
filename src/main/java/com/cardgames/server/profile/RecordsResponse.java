package com.cardgames.server.profile;

import java.time.LocalDateTime;
import java.util.UUID;

/** DEV-151: personal best sessions. */
public record RecordsResponse(
    PersonalBest fewestMoves,
    PersonalBest fastestTime
) {
    public record PersonalBest(
        UUID          sessionUuid,
        UUID          handUuid,
        String        drawMode,
        int           moves,
        int           timeSeconds,
        LocalDateTime completedAt
    ) {}
}
