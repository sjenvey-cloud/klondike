package com.cardgames.server.profile;

import java.util.Date;

/** Sanitised user profile — never includes password_hash. */
public record ProfileResponse(
    int    id,
    String displayName,
    String email,
    Date   createdAt,
    Date   lastHand
) {}
