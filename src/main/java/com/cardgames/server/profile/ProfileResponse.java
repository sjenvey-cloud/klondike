package com.cardgames.server.profile;

import com.cardgames.server.user.User;

import java.util.Date;
import java.util.List;
import java.util.UUID;

/** Sanitised user profile — never includes password_hash. */
public record ProfileResponse(
    int          id,
    UUID         uuid,
    String       displayName,
    String       email,
    Date         createdAt,
    Date         lastHand,
    String       avatarUrl,
    List<String> linkedProviders   // DEV-333: e.g. ["local", "game_center"]
) {
    /** Central mapping from a User + their linked auth providers. */
    public static ProfileResponse from(User user, List<String> linkedProviders) {
        return new ProfileResponse(
            user.getId(),
            user.getUuid(),
            user.getDisplayName(),
            user.getEmail(),
            user.getdatecreated(),
            user.getlasthand(),
            user.getAvatarUrl(),
            linkedProviders
        );
    }
}
