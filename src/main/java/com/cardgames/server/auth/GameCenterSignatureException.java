package com.cardgames.server.auth;

/** Thrown when the Game Center ECDSA signature cannot be verified. */
public class GameCenterSignatureException extends RuntimeException {
    public GameCenterSignatureException(String message) {
        super(message);
    }
}
