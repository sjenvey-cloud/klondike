package com.cardgames.server.profile;

import java.time.Instant;
import java.util.UUID;

/** DEV-151: personal best sessions. */
public record RecordsResponse(
    PersonalBest fewestMoves,
    PersonalBest fastestTime
) {
    /**
     * completedAt is Instant (not LocalDateTime) so Jackson serialises it as
     * "2026-05-15T10:30:00Z" — a valid ISO 8601 UTC string that Foundation's
     * JSONDecoder can parse with the .iso8601 strategy.
     */
    public record PersonalBest(
        UUID    sessionUuid,
        UUID    handUuid,
        String  drawMode,
        int     moves,
        int     timeSeconds,
        Instant completedAt
    ) {}
}
