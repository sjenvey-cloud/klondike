package com.cardgames.server.auth;

/** JSON response body for register, login, and refresh endpoints. */
public record AuthResponse(String accessToken, UserDto user) {

    /** Minimal user payload returned alongside every auth response. */
    public record UserDto(Long id, String email, String displayName) {}
}
