package com.cardgames.server.session;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DEV-202: Response DTO for GET /api/v1/sessions/active.
 * isDaily lets the frontend choose the correct modal copy (Resume/Redeal vs Resume/Start New)
 * and only show the modal on the matching screen (/daily vs /game).
 */
public record ActiveSessionResponse(
    UUID          uuid,
    UUID          handUuid,
    String        drawMode,
    int           moves,
    LocalDateTime startedAt,
    boolean       isDaily
) {}
