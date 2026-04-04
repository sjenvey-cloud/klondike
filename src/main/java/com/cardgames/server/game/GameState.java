package com.cardgames.server.game;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/**
 * Server-side Klondike game state.
 *
 * Mirrors the JS buildGameState() / applyDrawStock() / move logic exactly
 * so we can replay the client's move history and validate it server-side
 * (DEV-59).
 *
 * Move token format (matches MOVE_TYPES in gameEngine.js):
 *   draw          - draw up to drawCount cards from stock (or flip waste)
 *   wt:col        - top waste card → tableau column col (0-based)
 *   wf            - top waste card → foundation (suit determines pile)
 *   tt:from:to    - card stack from tableau col → tableau col
 *   tf:from       - top of tableau col → foundation
 *   abandon       - game abandoned (no further validation)
 */
public class GameState {

    private static final String[] SUIT_ORDER = { "clubs", "diamonds", "hearts", "spades" };

    private final int drawCount;

    // Tableau: 7 piles
    private final List<List<Card>> tableau = new ArrayList<>();
    // Foundations: indexed by suit order above (0=clubs 1=diamonds 2=hearts 3=spades)
    private final List<List<Card>> foundations = new ArrayList<>();
    // Stock and waste as stacks (front = top)
    private final Deque<Card> stock = new ArrayDeque<>();
    private final List<Card>  waste = new ArrayList<>();

    private int moveCount = 0;

    // ── Build initial state from a shuffle seed (DEV-73) ──────────────────
    public GameState(long seed) {
        this(seed, "draw3");
    }

    public GameState(long seed, String drawMode) {
        this(SeededShuffle.shuffle(seed), drawMode);
    }

    // ── Build initial state from 52 ordered card IDs ──────────────────────
    public GameState(int[] cardIds) {
        this(cardIds, "draw3");
    }

    public GameState(int[] cardIds, String drawMode) {
        this.drawCount = "draw1".equals(drawMode) ? 1 : 3;
        // Deal tableau: pile i has i+1 cards, last is face-up
        int idx = 0;
        for (int i = 0; i < 7; i++) {
            List<Card> pile = new ArrayList<>();
            for (int j = 0; j <= i; j++) {
                pile.add(new Card(cardIds[idx], j == i));
                idx++;
            }
            tableau.add(pile);
        }
        // Remaining 24 cards go to stock face-down (first card = top of stock)
        for (int i = idx; i < 52; i++) {
            stock.push(new Card(cardIds[i], false));
        }
        // Reverse so stock[0] is drawn first (push inverts order)
        Deque<Card> ordered = new ArrayDeque<>();
        for (Card c : stock) ordered.addFirst(c);
        stock.clear();
        stock.addAll(ordered);
        // Foundations
        for (int i = 0; i < 4; i++) foundations.add(new ArrayList<>());
    }

    // ── Replay a comma-separated turns string ─────────────────────────────
    public ReplayResult replay(String turns) {
        if (turns == null || turns.isBlank()) {
            return new ReplayResult(false, "Empty turns string", moveCount);
        }
        String[] tokens = turns.split(",");
        for (String raw : tokens) {
            String token = raw.trim();
            if (token.isEmpty()) continue;
            if ("abandon".equals(token)) break; // abandoned — stop here
            boolean ok = applyMove(token);
            if (!ok) {
                return new ReplayResult(false, "Invalid move: [" + token + "] after " + moveCount + " moves", moveCount);
            }
        }
        return new ReplayResult(true, "OK", moveCount);
    }

    // ── Apply a single move token ──────────────────────────────────────────
    private boolean applyMove(String token) {
        String[] parts = token.split(":");
        switch (parts[0]) {
            case "draw": return applyDraw();
            case "wt":   return parts.length >= 2 && applyWasteToTableau(Integer.parseInt(parts[1]));
            case "wf":   return applyWasteToFoundation();
            case "tt":   return parts.length >= 3 && applyTableauToTableau(Integer.parseInt(parts[1]), Integer.parseInt(parts[2]));
            case "tf":   return parts.length >= 2 && applyTableauToFoundation(Integer.parseInt(parts[1]));
            default:
                return false;
        }
    }

    // ── Draw (DEV-15, DEV-58) ─────────────────────────────────────────────
    private boolean applyDraw() {
        if (stock.isEmpty()) {
            // Flip waste back to stock
            for (int i = waste.size() - 1; i >= 0; i--) {
                Card c = new Card(waste.get(i));
                c.setFaceUp(false);
                stock.addFirst(c);
            }
            waste.clear();
        } else {
            int count = Math.min(drawCount, stock.size());
            for (int i = 0; i < count; i++) {
                Card c = stock.poll();
                c.setFaceUp(true);
                waste.add(c);
            }
        }
        moveCount++;
        return true;
    }

    // ── Waste → Tableau ───────────────────────────────────────────────────
    private boolean applyWasteToTableau(int col) {
        if (waste.isEmpty() || col < 0 || col >= 7) return false;
        Card card = waste.get(waste.size() - 1);
        List<Card> pile = tableau.get(col);
        if (!canPlaceOnTableau(card, pile)) return false;
        waste.remove(waste.size() - 1);
        tableau.get(col).add(card);
        moveCount++;
        return true;
    }

    // ── Waste → Foundation ────────────────────────────────────────────────
    private boolean applyWasteToFoundation() {
        if (waste.isEmpty()) return false;
        Card card = waste.get(waste.size() - 1);
        int fIdx = suitIndex(card.getSuit());
        if (fIdx < 0) return false;
        List<Card> foundation = foundations.get(fIdx);
        if (!canPlaceOnFoundation(card, foundation)) return false;
        waste.remove(waste.size() - 1);
        card.setFaceUp(true);
        foundation.add(card);
        moveCount++;
        return true;
    }

    // ── Tableau → Tableau (moves entire face-up stack) ────────────────────
    private boolean applyTableauToTableau(int from, int to) {
        if (from < 0 || from >= 7 || to < 0 || to >= 7 || from == to) return false;
        List<Card> srcPile  = tableau.get(from);
        List<Card> destPile = tableau.get(to);

        // Find the first face-up card (bottom of the moving stack)
        int splitIdx = -1;
        for (int i = 0; i < srcPile.size(); i++) {
            if (srcPile.get(i).isFaceUp()) { splitIdx = i; break; }
        }
        if (splitIdx < 0) return false;

        Card bottomOfStack = srcPile.get(splitIdx);
        if (!canPlaceOnTableau(bottomOfStack, destPile)) return false;

        List<Card> moving = new ArrayList<>(srcPile.subList(splitIdx, srcPile.size()));
        srcPile.subList(splitIdx, srcPile.size()).clear();

        // Flip new top of source pile
        if (!srcPile.isEmpty()) srcPile.get(srcPile.size() - 1).setFaceUp(true);

        destPile.addAll(moving);
        moveCount++;
        return true;
    }

    // ── Tableau → Foundation ──────────────────────────────────────────────
    private boolean applyTableauToFoundation(int col) {
        if (col < 0 || col >= 7) return false;
        List<Card> srcPile = tableau.get(col);
        if (srcPile.isEmpty()) return false;
        Card card = srcPile.get(srcPile.size() - 1);
        if (!card.isFaceUp()) return false;
        int fIdx = suitIndex(card.getSuit());
        if (fIdx < 0) return false;
        List<Card> foundation = foundations.get(fIdx);
        if (!canPlaceOnFoundation(card, foundation)) return false;
        srcPile.remove(srcPile.size() - 1);
        if (!srcPile.isEmpty()) srcPile.get(srcPile.size() - 1).setFaceUp(true);
        card.setFaceUp(true);
        foundation.add(card);
        moveCount++;
        return true;
    }

    // ── Validation rules ──────────────────────────────────────────────────
    private boolean canPlaceOnTableau(Card card, List<Card> pile) {
        if (pile.isEmpty()) return card.getRank() == 13; // King only
        Card top = pile.get(pile.size() - 1);
        if (!top.isFaceUp()) return false;
        return top.getRank() == card.getRank() + 1 && top.isRed() != card.isRed();
    }

    private boolean canPlaceOnFoundation(Card card, List<Card> foundation) {
        if (foundation.isEmpty()) return card.getRank() == 1; // Ace only
        Card top = foundation.get(foundation.size() - 1);
        return top.getSuit().equals(card.getSuit()) && top.getRank() == card.getRank() - 1;
    }

    // ── Win check ─────────────────────────────────────────────────────────
    public boolean isWon() {
        return foundations.stream().allMatch(f -> f.size() == 13);
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    private int suitIndex(String suit) {
        for (int i = 0; i < SUIT_ORDER.length; i++) {
            if (SUIT_ORDER[i].equals(suit)) return i;
        }
        return -1;
    }

    public int getMoveCount() { return moveCount; }
}
