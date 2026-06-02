package com.cardgames.server.auth;

/**
 * Thrown when a Game Center identity is already linked to a *different* user account.
 * Surfaced as HTTP 409 Conflict by {@link AuthController}.
 */
public class GameCenterAlreadyLinkedException extends RuntimeException {
    public GameCenterAlreadyLinkedException() {
        super("This Game Center account is already linked to another Klondike Pro account.");
    }
}
