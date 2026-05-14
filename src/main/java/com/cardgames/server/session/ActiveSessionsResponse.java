package com.cardgames.server.session;

/**
 * DEV-202: Response DTO for GET /api/v1/sessions/active.
 *
 * Returns the most recent active session for each type independently so the
 * frontend can offer a resume prompt on the correct screen without the daily
 * session bleeding into the random-hand screen and vice versa.
 *
 * Both fields are nullable — null means no in-progress session of that type.
 * The endpoint always returns HTTP 200 (never 204) so the client can reliably
 * parse the JSON without special-casing an empty response.
 */
public record ActiveSessionsResponse(
    ActiveSessionResponse daily,
    ActiveSessionResponse random
) {}
