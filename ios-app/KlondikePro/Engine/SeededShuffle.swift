import Foundation

/// xorshift32 pseudo-random number generator.
///
/// This implementation MUST produce identical output to:
///   - `SeededShuffle.java`  (Spring Boot backend — server-side replay validation)
///   - `seededShuffle.ts`    (React web app — client-side deal)
///
/// The algorithm is: xorshift32 using the seed as state, then Fisher-Yates
/// shuffle of card IDs [1…52].
///
/// Verified by `SeededShuffleTests` with shared test vectors from the backend.
enum SeededShuffle {

    // MARK: - Core algorithm

    /// Advance the xorshift32 state and return the next pseudo-random UInt32.
    /// All three shift parameters must match Java and TypeScript exactly.
    private static func next(_ state: inout UInt32) -> UInt32 {
        state ^= state &<< 13
        state ^= state &>> 17
        state ^= state &<< 5
        return state
    }

    // MARK: - Public API

    /// Shuffle card IDs [1…52] deterministically from `seed`.
    ///
    /// - Parameter seed: a 64-bit seed value (only the lower 32 bits are used,
    ///   matching the server's `(int) seed` cast in Java).
    /// - Returns: array of 52 card IDs in shuffled order.
    static func shuffle(seed: Int64) -> [Int] {
        var state = UInt32(truncatingIfNeeded: seed)
        if state == 0 { state = 1 }  // xorshift32 must not start at 0

        var deck = Array(1...52)

        for i in stride(from: 51, through: 1, by: -1) {
            let rand  = next(&state)
            let j     = Int(rand) % (i + 1)
            // abs() guard: Int(rand) is always ≥ 0 for UInt32 → Int on 64-bit
            let safeJ = (j < 0) ? -j : j
            deck.swapAt(i, safeJ)
        }
        return deck
    }

    /// Convert a shuffled array of card IDs into `Card` objects.
    /// Top of stock = index 0; tableau columns dealt left to right per Klondike rules.
    static func deal(seed: Int64) -> [Card] {
        shuffle(seed: seed).compactMap { Card(id: $0, isFaceUp: false) }
    }
}
