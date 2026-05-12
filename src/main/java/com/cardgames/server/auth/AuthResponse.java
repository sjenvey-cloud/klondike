package com.cardgames.server.auth;

import java.util.UUID;

/** JSON response body for register, login, and refresh endpoints. */
public record AuthResponse(String accessToken, UserDto user) {

    /**
     * Minimal user payload returned alongside every auth response.
     * uuid is the public identifier used for leaderboard row-highlighting
     * and any future client-to-client references.
     * id is kept for backward compatibility with cached localStorage values.
     */
    public record UserDto(Long id, UUID uuid, String email, String displayName) {}
}
