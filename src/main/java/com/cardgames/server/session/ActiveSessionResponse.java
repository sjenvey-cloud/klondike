package com.cardgames.server.session;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DEV-202: Response DTO for GET /api/v1/sessions/active.
 */
public record ActiveSessionResponse(
    UUID          uuid,
    UUID          handUuid,
    String        drawMode,
    int           moves,
    LocalDateTime startedAt
) {}
