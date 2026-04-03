package com.cardgames.server.auth;

import org.springframework.http.ResponseCookie;

/** Internal record pairing an access token with the refresh token cookie. */
public record AuthTokenPair(String accessToken, ResponseCookie refreshCookie) {}
