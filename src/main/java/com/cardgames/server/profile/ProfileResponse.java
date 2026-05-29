package com.cardgames.server.profile;

import java.util.Date;
import java.util.UUID;

/** Sanitised user profile — never includes password_hash. */
public record ProfileResponse(
    int    id,
    UUID   uuid,
    String displayName,
    String email,
    Date   createdAt,
    Date   lastHand,
    String avatarUrl
) {}
