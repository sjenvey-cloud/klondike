package com.cardgames.server.session;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.UUID;

/**
 * Request body for POST /api/v1/sessions/offline — a game played offline, submitted
 * once connectivity returns.
 *
 * The whole game is described from its deterministic seed plus the move history, so
 * the server can reproduce the hand, replay + validate a win, and record it without
 * the client ever having created a server session up front. {@code clientId} is a
 * client-generated idempotency key so the submission can be retried safely.
 */
public record OfflineSessionRequest(
        UUID   clientId,
        long   seed,
        String drawMode,
        @JsonProperty("isDaily") boolean isDaily,
        String dailyDate,
        String status,      // "won" | "abandoned"
        int    moves,
        int    timeSeconds,
        String turns) {}
