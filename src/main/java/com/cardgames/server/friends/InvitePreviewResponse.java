package com.cardgames.server.friends;

/** Response for GET /api/v1/friends/invites/preview/{token} */
public record InvitePreviewResponse(
    String token,
    String inviterDisplayName
) {}
