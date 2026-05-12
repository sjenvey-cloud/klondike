package com.cardgames.server.session;

import java.time.LocalDateTime;

/**
 * DEV-202: Response DTO for GET /api/v1/sessions/active.
 */
public record ActiveSessionResponse(
    int           id,
    int           handId,
    String        drawMode,
    int           moves,
    LocalDateTime startedAt
) {}
