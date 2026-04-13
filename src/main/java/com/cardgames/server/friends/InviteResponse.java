package com.cardgames.server.friends;

import java.time.LocalDateTime;

/** DEV-155: response for POST /api/v1/friends/invite */
public record InviteResponse(
    String        token,
    String        inviteUrl,
    LocalDateTime expiresAt
) {}
