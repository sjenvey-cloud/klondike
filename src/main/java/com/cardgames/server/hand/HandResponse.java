package com.cardgames.server.hand;

import java.util.UUID;

/**
 * Response body for POST /api/v1/hands.
 *
 * Returns the hand UUID, the seed (so the client can reproduce the shuffle
 * locally for DEV-73), and the full card order so the client can build
 * the initial game state immediately without a second request.
 */
public record HandResponse(UUID uuid, long shuffleSeed, int[] cards, String drawMode) {}
