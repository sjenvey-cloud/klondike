package com.cardgames.server.auth;

public class InvalidTokenException extends RuntimeException {
    public InvalidTokenException() {
        super("Refresh token is invalid or expired");
    }
}
