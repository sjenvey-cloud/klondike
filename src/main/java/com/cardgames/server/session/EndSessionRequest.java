package com.cardgames.server.session;

/**
 * Request body for POST /api/v1/sessions/{id}/complete
 *               and POST /api/v1/sessions/{id}/abandon
 *
 * The client sends the final move count, elapsed time, and full turns
 * string at the end of the game — no mid-game saves.
 */
public record EndSessionRequest(int moves, int timeSeconds, String turns) {}
