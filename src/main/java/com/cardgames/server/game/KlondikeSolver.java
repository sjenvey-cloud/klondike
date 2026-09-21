package com.cardgames.server.game;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Full-information Klondike solvability check.
 *
 * Given a 52-card deal (card IDs 1-52, same encoding + layout as {@link GameState})
 * and a draw mode, decides whether the deal can be played to a win. The check is
 * <b>sound</b>: it returns a solution only when it has actually found a winning line
 * of legal moves, so any deal it accepts is genuinely completable. It is
 * <b>bounded</b> (a fixed node budget) and may therefore fail to solve a deal that
 * is winnable but too hard within budget — safe here because the caller just tries
 * the next candidate.
 *
 * Rules mirror {@link GameState} exactly (build down by alternating colour, empty
 * column takes a King only, foundations build up by suit from the Ace, draw 1 or 3,
 * <b>unlimited</b> redeals, move a face-up run between tableau piles) and the move
 * tokens it emits (draw / wt:col / wf / tt:from:idx:to / tf:col) replay cleanly
 * through {@link GameState#replay}. Because a deal is deterministic, "there exists a
 * legal winning sequence" is exactly "a player can complete this hand".
 *
 * Determinism: pure function of its inputs (fixed move ordering, node budget by
 * count not wall-clock), so daily-hand selection built on it is reproducible.
 */
public final class KlondikeSolver {

    private KlondikeSolver() {}

    /** Default search budget (states expanded) before giving up on a candidate. */
    public static final int DEFAULT_NODE_BUDGET = 200_000;

    /** Guard against a pathologically long single DFS path (well above any real solution). */
    private static final int MAX_DEPTH = 800;

    public static boolean isWinnable(int[] deck, String drawMode) {
        return solve(deck, drawMode, DEFAULT_NODE_BUDGET) != null;
    }

    public static boolean isWinnable(int[] deck, String drawMode, int nodeBudget) {
        return solve(deck, drawMode, nodeBudget) != null;
    }

    /**
     * Returns a winning move sequence (comma-separated {@link GameState} tokens) for
     * the deal, or {@code null} if none was found within the node budget.
     */
    public static String solve(int[] deck, String drawMode, int nodeBudget) {
        int drawCount = "draw1".equals(drawMode) ? 1 : 3;
        Search search = new Search(drawCount, nodeBudget);
        Reduction r0 = reduce(State.deal(deck));
        search.path.addAll(r0.tokens);
        if (search.dfs(r0.state, 0)) {
            return String.join(",", search.solution);
        }
        return null;
    }

    // ── Card helpers (encoding matches GameState: clubs 1-13, diamonds 14-26, hearts 27-39, spades 40-52) ──
    static int  rank(int id)  { return ((id - 1) % 13) + 1; }
    static int  suit(int id)  { return (id - 1) / 13; }          // 0 clubs, 1 diamonds, 2 hearts, 3 spades
    static boolean isRed(int id) { int s = suit(id); return s == 1 || s == 2; }

    private static boolean canPlaceOnTab(int card, int[] destPile) {
        if (destPile.length == 0) return rank(card) == 13;      // empty column: King only
        int top = destPile[destPile.length - 1];                // a pile's top is always face-up
        return rank(top) == rank(card) + 1 && isRed(top) != isRed(card);
    }

    /**
     * A card is "safe" to send to the foundation without ever needing it back in the
     * tableau: both opposite-colour foundations are already at rank ≥ r-1, so no
     * opposite-colour (r-1) card can still need this card as a tableau landing spot.
     * Aces are always safe. Auto-playing only safe cards never loses a winnable game.
     */
    private static boolean isSafe(int card, int[] found) {
        int r = rank(card);
        if (r <= 1) return true;
        int minOpp = isRed(card) ? Math.min(found[0], found[3])   // opposite of red = black (clubs, spades)
                                 : Math.min(found[1], found[2]);  // opposite of black = red (diamonds, hearts)
        return r <= minOpp + 1;
    }

    // ── Safe-foundation auto-play (a sound state reduction applied before branching) ──
    private static Reduction reduce(State s) {
        List<String> tokens = new ArrayList<>();
        State cur = s;
        boolean copied = false;
        boolean changed = true;
        while (changed) {
            changed = false;

            // Waste top → foundation, if safe
            if (cur.waste.length > 0) {
                int c = cur.waste[cur.waste.length - 1];
                if (cur.found[suit(c)] == rank(c) - 1 && isSafe(c, cur.found)) {
                    if (!copied) { cur = cur.copy(); copied = true; }
                    cur.waste = Arrays.copyOf(cur.waste, cur.waste.length - 1);
                    cur.found[suit(c)] = rank(c);
                    tokens.add("wf");
                    changed = true;
                    continue;
                }
            }
            // Tableau top → foundation, if safe
            for (int i = 0; i < 7; i++) {
                int[] p = cur.tab[i];
                if (p.length == 0) continue;
                int c = p[p.length - 1];
                if (cur.found[suit(c)] == rank(c) - 1 && isSafe(c, cur.found)) {
                    if (!copied) { cur = cur.copy(); copied = true; }
                    removeTopAndFlip(cur, i);
                    cur.found[suit(c)] = rank(c);
                    tokens.add("tf:" + i);
                    changed = true;
                    break;
                }
            }
        }
        return new Reduction(cur, tokens);
    }

    /** Remove the (face-up) top of pile i and flip the newly exposed card if it was face-down. */
    private static void removeTopAndFlip(State n, int i) {
        int[] p = n.tab[i];
        n.tab[i] = Arrays.copyOf(p, p.length - 1);
        int len = n.tab[i].length;
        if (len == 0)              n.down[i] = 0;
        else if (len == n.down[i]) n.down[i] = n.down[i] - 1;   // the new top was face-down → flip it up
    }

    private static final class Reduction {
        final State state;
        final List<String> tokens;
        Reduction(State state, List<String> tokens) { this.state = state; this.tokens = tokens; }
    }

    private static final class Move {
        final String token;
        final State  state;
        Move(String token, State state) { this.token = token; this.state = state; }
    }

    // ── Search ──────────────────────────────────────────────────────────────
    private static final class Search {
        final int drawCount;
        int nodesLeft;
        final Set<String> visited = new HashSet<>();
        final List<String> path = new ArrayList<>();   // tokens along the current DFS path
        List<String> solution;

        Search(int drawCount, int nodeBudget) {
            this.drawCount = drawCount;
            this.nodesLeft = nodeBudget;
        }

        boolean dfs(State s, int depth) {
            if (s.isWon()) { solution = new ArrayList<>(path); return true; }
            if (nodesLeft <= 0 || depth > MAX_DEPTH) return false;
            nodesLeft--;
            if (!visited.add(s.key())) return false;   // symmetry-reduced dedup

            for (Move m : generate(s)) {
                Reduction r = reduce(m.state);
                int added = 1 + r.tokens.size();
                path.add(m.token);
                path.addAll(r.tokens);
                boolean ok = dfs(r.state, depth + 1);
                if (ok) return true;
                for (int k = 0; k < added; k++) path.remove(path.size() - 1);  // backtrack
            }
            return false;
        }

        /** Ordered successor moves: most promising first (safe foundation plays handled by reduce()). */
        List<Move> generate(State s) {
            List<Move> reveals = new ArrayList<>();     // flips a face-down card
            List<Move> empties = new ArrayList<>();     // empties a column
            List<Move> wasteToTab = new ArrayList<>();
            List<Move> otherTab = new ArrayList<>();
            List<Move> unsafeFound = new ArrayList<>();
            List<Move> draws = new ArrayList<>();

            // Waste top → tableau
            if (s.waste.length > 0) {
                int c = s.waste[s.waste.length - 1];
                for (int j = 0; j < 7; j++) {
                    if (canPlaceOnTab(c, s.tab[j])) wasteToTab.add(new Move("wt:" + j, applyWasteToTab(s, j)));
                }
            }

            // Tableau run → tableau
            for (int i = 0; i < 7; i++) {
                int[] p = s.tab[i];
                int d = s.down[i];
                for (int fromIdx = d; fromIdx < p.length; fromIdx++) {   // face-up cards only
                    int c = p[fromIdx];
                    for (int j = 0; j < 7; j++) {
                        if (j == i || !canPlaceOnTab(c, s.tab[j])) continue;
                        boolean destEmpty = s.tab[j].length == 0;
                        // Moving an entire face-up pile onto an empty column is a pointless
                        // empty-for-empty swap (a King shuffle) — skip it.
                        if (destEmpty && fromIdx == 0) continue;
                        Move mv = new Move("tt:" + i + ":" + fromIdx + ":" + j, applyTabToTab(s, i, fromIdx, j));
                        if (fromIdx == d && d > 0)   reveals.add(mv);
                        else if (fromIdx == 0)       empties.add(mv);
                        else                          otherTab.add(mv);
                    }
                }
            }

            // Unsafe foundation moves (safe ones already auto-played in reduce)
            if (s.waste.length > 0) {
                int c = s.waste[s.waste.length - 1];
                if (s.found[suit(c)] == rank(c) - 1 && !isSafe(c, s.found)) {
                    unsafeFound.add(new Move("wf", applyWasteToFound(s)));
                }
            }
            for (int i = 0; i < 7; i++) {
                int[] p = s.tab[i];
                if (p.length == 0) continue;
                int c = p[p.length - 1];
                if (s.found[suit(c)] == rank(c) - 1 && !isSafe(c, s.found)) {
                    unsafeFound.add(new Move("tf:" + i, applyTabTopToFound(s, i)));
                }
            }

            // Draw / recycle (unless nothing is in stock or waste)
            if (s.stock.length > 0 || s.waste.length > 0) {
                draws.add(new Move("draw", applyDraw(s)));
            }

            List<Move> out = new ArrayList<>(
                reveals.size() + empties.size() + wasteToTab.size()
                + otherTab.size() + unsafeFound.size() + draws.size());
            out.addAll(reveals);
            out.addAll(empties);
            out.addAll(wasteToTab);
            out.addAll(otherTab);
            out.addAll(unsafeFound);
            out.addAll(draws);
            return out;
        }

        private State applyDraw(State s) {
            State n = s.copy();
            if (n.stock.length == 0) {
                n.stock = n.waste.clone();          // recycle: waste[0] becomes the next drawn
                n.waste = new int[0];
            } else {
                int cnt = Math.min(drawCount, n.stock.length);
                int[] drawn = Arrays.copyOfRange(n.stock, 0, cnt);
                n.stock = Arrays.copyOfRange(n.stock, cnt, n.stock.length);
                int[] nw = Arrays.copyOf(n.waste, n.waste.length + cnt);
                System.arraycopy(drawn, 0, nw, n.waste.length, cnt);
                n.waste = nw;                        // top of waste = last drawn
            }
            return n;
        }
    }

    private static State applyWasteToTab(State s, int j) {
        State n = s.copy();
        int c = n.waste[n.waste.length - 1];
        n.waste = Arrays.copyOf(n.waste, n.waste.length - 1);
        n.tab[j] = append(n.tab[j], c);
        return n;
    }

    private static State applyWasteToFound(State s) {
        State n = s.copy();
        int c = n.waste[n.waste.length - 1];
        n.waste = Arrays.copyOf(n.waste, n.waste.length - 1);
        n.found[suit(c)] = rank(c);
        return n;
    }

    private static State applyTabTopToFound(State s, int i) {
        State n = s.copy();
        int c = n.tab[i][n.tab[i].length - 1];
        removeTopAndFlip(n, i);
        n.found[suit(c)] = rank(c);
        return n;
    }

    private static State applyTabToTab(State s, int i, int fromIdx, int j) {
        State n = s.copy();
        int[] src = n.tab[i];
        int[] moving = Arrays.copyOfRange(src, fromIdx, src.length);
        n.tab[i] = Arrays.copyOf(src, fromIdx);
        int len = n.tab[i].length;
        if (len == 0)              n.down[i] = 0;
        else if (len == n.down[i]) n.down[i] = n.down[i] - 1;   // exposed a face-down card → flip
        int[] dst = n.tab[j];
        int[] nd = Arrays.copyOf(dst, dst.length + moving.length);
        System.arraycopy(moving, 0, nd, dst.length, moving.length);
        n.tab[j] = nd;
        return n;
    }

    private static int[] append(int[] a, int v) {
        int[] r = Arrays.copyOf(a, a.length + 1);
        r[a.length] = v;
        return r;
    }

    // ── State ─────────────────────────────────────────────────────────────
    private static final class State {
        int[][] tab;    // 7 piles, bottom → top
        int[]   down;   // face-down count per pile (the bottom `down[i]` cards)
        int[]   found;  // 4 suits, top rank placed (0 = empty)
        int[]   stock;  // front → back, index 0 = next drawn
        int[]   waste;  // bottom → top, last = playable top

        static State deal(int[] deck) {
            State s = new State();
            s.tab = new int[7][];
            s.down = new int[7];
            int idx = 0;
            for (int i = 0; i < 7; i++) {
                int[] pile = new int[i + 1];
                for (int j = 0; j <= i; j++) pile[j] = deck[idx++];
                s.tab[i] = pile;
                s.down[i] = i;                 // bottom i face-down, top 1 face-up
            }
            s.stock = Arrays.copyOfRange(deck, idx, 52);   // 24 cards, index 0 = next drawn
            s.waste = new int[0];
            s.found = new int[4];
            return s;
        }

        State copy() {
            State s = new State();
            s.tab = new int[7][];
            for (int i = 0; i < 7; i++) s.tab[i] = tab[i].clone();
            s.down  = down.clone();
            s.found = found.clone();
            s.stock = stock.clone();
            s.waste = waste.clone();
            return s;
        }

        boolean isWon() {
            return found[0] == 13 && found[1] == 13 && found[2] == 13 && found[3] == 13;
        }

        /**
         * Canonical key. Tableau piles are sorted before joining because columns are
         * positionally interchangeable in Klondike — this collapses equivalent states
         * and greatly improves dedup. Face-down cards are marked so identical-looking
         * piles with different hidden cards stay distinct.
         */
        String key() {
            String[] piles = new String[7];
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 7; i++) {
                sb.setLength(0);
                int[] p = tab[i];
                for (int jj = 0; jj < p.length; jj++) {
                    if (jj > 0) sb.append('.');
                    if (jj < down[i]) sb.append('-');   // face-down marker
                    sb.append(p[jj]);
                }
                piles[i] = sb.toString();
            }
            Arrays.sort(piles);
            StringBuilder k = new StringBuilder();
            for (String p : piles) k.append(p).append('/');
            k.append('F');
            for (int f : found)  k.append(f).append('.');
            k.append('S');
            for (int c : stock)  k.append(c).append('.');
            k.append('W');
            for (int c : waste)  k.append(c).append('.');
            return k.toString();
        }
    }
}
