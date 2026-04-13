package com.cardgames.server.friends;

import java.util.Date;

/** DEV-157: one entry in the friends list */
public record FriendResponse(
    int    userId,
    String displayName,
    Date   lastActive,
    int    gamesCompletedToday
) {}
