package com.cardgames.server.game;

/**
 * DEV-73: Deterministic Fisher-Yates shuffle using xorshift32 PRNG.
 *
 * Given the same seed this class produces the same 52-card order on both
 * the Java server and the JavaScript client, enabling server-side replay
 * without transmitting all 52 card IDs.
 *
 * ── JS equivalent (must produce identical results) ────────────────────────
 *
 *   function xorshift32(state) {
 *     state ^= state << 13;
 *     state ^= state >>> 17;
 *     state ^= state << 5;
 *     return state >>> 0;        // coerce to unsigned 32-bit
 *   }
 *
 *   export function seededShuffle(seed) {
 *     const deck = Array.from({ length: 52 }, (_, i) => i + 1);
 *     let state = seed >>> 0;    // treat seed as unsigned 32-bit
 *     for (let i = 51; i > 0; i--) {
 *       state = xorshift32(state);
 *       const j = state % (i + 1);   // state is already unsigned after >>> 0
 *       [deck[i], deck[j]] = [deck[j], deck[i]];
 *     }
 *     return deck;
 *   }
 *
 * ── Portability notes ─────────────────────────────────────────────────────
 *  - xorshift32 operates on bit patterns; Java's signed int is fine for the
 *    shift steps as long as >>> (unsigned right shift) is used for the >> 17
 *    step — matching JS's >>> 17.
 *  - The only place signed/unsigned matters numerically is the modulo step.
 *    Java int can be negative after XOR shifts, so we convert to a long via
 *    Integer.toUnsignedLong() before % — identical to JS's implicit >>> 0.
 *  - Seeds must be in [1, 2^32) — zero is a degenerate xorshift32 fixed point
 *    and is excluded by the server at generation time.
 */
public final class SeededShuffle {

    private SeededShuffle() {}

    /**
     * Shuffle card IDs 1-52 using xorshift32 seeded with the given value.
     *
     * @param seed a value in [1, 2^32) — stored as Java long to avoid
     *             signed-overflow when seeds exceed Integer.MAX_VALUE
     * @return int[52] with card IDs 1-52 in shuffled order
     */
    public static int[] shuffle(long seed) {
        int[] deck = new int[52];
        for (int i = 0; i < 52; i++) deck[i] = i + 1;

        // Cast seed to unsigned 32-bit bit pattern — matches JS's `seed >>> 0`
        int state = (int) (seed & 0xFFFFFFFFL);

        for (int i = 51; i > 0; i--) {
            // xorshift32 step
            state ^= state << 13;
            state ^= state >>> 17;  // unsigned right shift — matches JS >>>
            state ^= state << 5;

            // Unsigned modulo — Integer.toUnsignedLong matches JS's >>> 0
            int j = (int) (Integer.toUnsignedLong(state) % (i + 1));

            int tmp = deck[i];
            deck[i] = deck[j];
            deck[j] = tmp;
        }

        return deck;
    }
}
