package com.cardgames.server.hand;

/**
 * Response body for POST /api/v1/hands.
 *
 * Returns the hand ID, the seed (so the client can reproduce the shuffle
 * locally for DEV-73), and the full card order so the client can build
 * the initial game state immediately without a second request.
 */
public record HandResponse(int id, long shuffleSeed, int[] cards) {}
