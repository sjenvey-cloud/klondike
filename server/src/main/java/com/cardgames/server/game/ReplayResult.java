package com.cardgames.server.game;

/**
 * Result returned by GameState.replay() and the /deal/validate endpoint.
 */
public class ReplayResult {

    private final boolean valid;
    private final String  message;
    private final int     moveCount;

    public ReplayResult(boolean valid, String message, int moveCount) {
        this.valid     = valid;
        this.message   = message;
        this.moveCount = moveCount;
    }

    public boolean isValid()    { return valid; }
    public String  getMessage() { return message; }
    public int     getMoveCount() { return moveCount; }
}
