package com.cardgames.server.session;

/**
 * Response body for POST /api/v1/sessions/{id}/complete
 *
 * Mirrors the ReplayResult fields so the client knows why validation
 * passed or failed, plus the final persisted session state.
 */
public record CompleteSessionResponse(boolean valid, String message, int moveCount, Session session) {}
