package com.cardgames.server.friends;

import java.time.LocalDateTime;

/** One pending friend request shown in GET /friends/requests/received */
public record FriendRequestEntry(
    int           id,
    int           requesterId,
    String        requesterDisplayName,
    String        requesterLocation,   // device region, may be null
    long          requesterGamesPlayed,
    LocalDateTime createdAt
) {}
