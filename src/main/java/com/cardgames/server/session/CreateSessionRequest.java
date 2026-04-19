package com.cardgames.server.session;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Request body for POST /api/v1/sessions
 *
 * @JsonProperty on boolean record components is required because Jackson's
 * JavaBean introspection strips the "is" prefix from getter names, mapping
 * isDaily() → "daily" instead of "isDaily". The explicit annotation pins
 * the JSON field name to match what the frontend sends.
 */
public record CreateSessionRequest(
        int handId,
        int userId,
        @JsonProperty("isDaily")  boolean isDaily,
        String dailyDate,
        Boolean isRanked) {}
