package com.cardgames.server.friends;

import java.time.LocalDateTime;

/** Response for GET /api/v1/friends/invites — one entry per pending sent invite */
public record SentInviteResponse(
    int           id,
    String        token,
    String        inviteUrl,
    LocalDateTime expiresAt,
    LocalDateTime createdAt
) {}
