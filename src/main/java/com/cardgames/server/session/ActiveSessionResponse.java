package com.cardgames.server.session;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DEV-202 / DEV-252: Response DTO for GET /api/v1/sessions/active.
 *
 * isDaily lets the frontend choose the correct modal copy (Resume/Redeal vs Resume/Start New)
 * and only show the modal on the matching screen (/daily vs /game).
 *
 * DEV-252: Added seed and turns so iOS clients can reconstruct game state locally
 * without a separate round-trip to GET /api/v1/hands/{uuid}.
 * - seed: the hand's shuffle_seed — passed to SeededShuffle on the client
 * - turns: comma-separated move tokens — replayed to restore in-progress board state
 */
public record ActiveSessionResponse(
    UUID          uuid,
    UUID          handUuid,
    String        drawMode,
    long          seed,
    String        turns,
    int           moves,
    LocalDateTime startedAt,
    boolean       isDaily
) {}
