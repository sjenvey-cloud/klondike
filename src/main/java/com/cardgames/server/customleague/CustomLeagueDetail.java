package com.cardgames.server.customleague;

import java.time.LocalDateTime;
import java.util.List;

/** Full detail for GET /custom-leagues/{id} */
public record CustomLeagueDetail(
    int                          id,
    String                       name,
    int                          creatorUserId,
    LocalDateTime                createdAt,
    boolean                      isCreator,
    List<CustomLeagueMemberEntry> members
) {}
