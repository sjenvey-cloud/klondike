package com.cardgames.server.replay;

import java.util.List;
import java.util.UUID;

/**
 * DEV-219: Full replay payload returned by GET /sessions/:uuid/replay.
 *
 * The frontend uses {@code cards} to reconstruct the initial deal via
 * dealKlondike(), then applies each move in {@code moves} to step through
 * the recorded game state.
 */
public record ReplayResponse(
    UUID             sessionUuid,
    UUID             handUuid,
    String           drawMode,
    int              totalMoves,
    List<ReplayMove> moves,
    int[]            cards        // 52-card deal order (matches server SeededShuffle output)
) {}
