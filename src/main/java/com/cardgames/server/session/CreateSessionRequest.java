package com.cardgames.server.session;

/**
 * Request body for POST /api/v1/sessions
 */
public record CreateSessionRequest(int handId, int userId) {}
