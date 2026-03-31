package com.cardgames.server.auth;

/** JSON response body for register, login, and refresh endpoints. */
public record AuthResponse(String accessToken) {}
