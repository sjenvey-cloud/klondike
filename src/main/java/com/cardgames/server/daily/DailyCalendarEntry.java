package com.cardgames.server.daily;

import java.util.UUID;

/**
 * One entry in the daily-challenge calendar response.
 * userStatus: "won" | "played" | "not_played"
 */
public record DailyCalendarEntry(String date, UUID handUuid, String drawMode, String userStatus) {}
