package com.cardgames.server.game;

/**
 * Immutable card representation mirroring the JS cardFromId() function.
 *
 * Card IDs 1-52:
 *   1-13  = clubs    A-K
 *   14-26 = diamonds A-K
 *   27-39 = hearts   A-K
 *   40-52 = spades   A-K
 */
public class Card {

    private static final String[] SUITS  = { "clubs", "diamonds", "hearts", "spades" };
    private static final String[] VALUES = { "A","2","3","4","5","6","7","8","9","10","J","Q","K" };

    private final int    id;
    private final String suit;
    private final String value;
    private final int    rank;   // 1 = Ace … 13 = King
    private boolean      faceUp;

    public Card(int id, boolean faceUp) {
        this.id     = id;
        this.faceUp = faceUp;
        int idx     = id - 1;
        this.suit   = SUITS[idx / 13];
        this.value  = VALUES[idx % 13];
        this.rank   = (idx % 13) + 1;
    }

    // Copy constructor
    public Card(Card other) {
        this.id     = other.id;
        this.suit   = other.suit;
        this.value  = other.value;
        this.rank   = other.rank;
        this.faceUp = other.faceUp;
    }

    public int     getId()     { return id; }
    public String  getSuit()   { return suit; }
    public String  getValue()  { return value; }
    public int     getRank()   { return rank; }
    public boolean isFaceUp()  { return faceUp; }
    public void    setFaceUp(boolean faceUp) { this.faceUp = faceUp; }

    public boolean isRed()   { return "diamonds".equals(suit) || "hearts".equals(suit); }
    public boolean isBlack() { return "clubs".equals(suit)    || "spades".equals(suit); }

    @Override
    public String toString() {
        return value + suit.charAt(0) + (faceUp ? "↑" : "↓");
    }
}
