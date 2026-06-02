package com.cardgames.server.profile;

/**
 * One day's activity summary for the profile calendar heatmap.
 * Returned by GET /api/v1/profile/calendar.
 *
 * Field names are camelCase — the iOS client's convertFromSnakeCase decoder
 * accepts them without any additional mapping.
 */
public record ProfileCalendarEntry(
        String date,          // "yyyy-MM-dd"
        int    gamesPlayed,
        int    gamesWon
) {}
