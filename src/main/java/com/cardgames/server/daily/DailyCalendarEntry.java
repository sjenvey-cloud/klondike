package com.cardgames.server.daily;

/**
 * One entry in the daily-challenge calendar response.
 * userStatus: "won" | "played" | "not_played"
 */
public record DailyCalendarEntry(String date, int handId, String drawMode, String userStatus) {}
