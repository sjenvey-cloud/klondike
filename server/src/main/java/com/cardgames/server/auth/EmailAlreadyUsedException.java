package com.cardgames.server.auth;

public class EmailAlreadyUsedException extends RuntimeException {
    public EmailAlreadyUsedException() {
        super("Email address is already registered");
    }
}
