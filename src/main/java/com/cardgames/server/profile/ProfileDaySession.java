package com.cardgames.server.profile;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.UUID;

/**
 * One completed session shown in the day-detail sheet.
 * Returned by GET /api/v1/profile/sessions?date=yyyy-MM-dd.
 *
 * @JsonProperty("isWon") is required because Jackson strips the "is" prefix
 * from boolean accessors by default; the iOS model expects the key "isWon".
 *
 * completedAt is Instant so it serialises as "...Z" — parseable by
 * Foundation's ISO 8601 date decoder on iOS.
 */
public record ProfileDaySession(
        UUID    uuid,
        UUID    handUuid,
        String  drawMode,
        int     moves,
        int     timeSeconds,
        @JsonProperty("isWon") boolean isWon,
        Instant completedAt
) {}
