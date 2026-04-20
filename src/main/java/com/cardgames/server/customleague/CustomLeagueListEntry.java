package com.cardgames.server.customleague;

import java.time.LocalDateTime;

/** One row in the GET /custom-leagues list */
public record CustomLeagueListEntry(
    int           id,
    String        name,
    int           creatorUserId,
    String        creatorDisplayName,
    int           memberCount,
    boolean       isCreator,
    LocalDateTime createdAt
) {}
