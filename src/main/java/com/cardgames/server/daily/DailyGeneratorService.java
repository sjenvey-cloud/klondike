package com.cardgames.server.daily;

import com.cardgames.server.game.SeededShuffle;
import com.cardgames.server.hand.Hand;
import com.cardgames.server.hand.HandRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Encapsulates the logic for selecting (or creating) today's daily-challenge hand
 * so it can be driven from both the HTTP endpoint (lazy fallback) and the
 * midnight scheduler.
 */
@Service
public class DailyGeneratorService {

    private static final Logger log = LoggerFactory.getLogger(DailyGeneratorService.class);

    // ── Ace accessibility scoring ──────────────────────────────────────────────
    // Card IDs for the four aces (clubs=1, diamonds=14, hearts=27, spades=40).
    private static final int[] ACE_IDS = { 1, 14, 27, 40 };

    // Indices within the 52-card shuffled array that are dealt face-up in the
    // Klondike tableau (col 0 top, col 1 top, ... col 6 top).
    private static final int[] FACE_UP_INDICES = { 0, 2, 5, 9, 14, 20, 27 };

    // How many candidate seeds to evaluate for each date when falling back to
    // the seeded algorithm. More candidates → better chance of a playable hand,
    // at a small compute cost (~10 shuffles of 52 cards each — negligible).
    private static final int CANDIDATE_COUNT = 12;

    // Minimum preferred distinct-winner count when promoting a community hand.
    // Hands won by ≥ 2 different players are guaranteed winnable and tend to be
    // of a reasonable difficulty.  Falls back to 1 if the library is still small.
    private static final int PREFERRED_WINNERS = 2;

    private final HandRepository           handRepo;
    private final DailyChallengeRepository dailyChallengeRepo;

    public DailyGeneratorService(HandRepository handRepo,
                                  DailyChallengeRepository dailyChallengeRepo) {
        this.handRepo           = handRepo;
        this.dailyChallengeRepo = dailyChallengeRepo;
    }

    /**
     * Idempotently ensures a daily-challenge hand exists for the given date and draw mode.
     * Safe to call multiple times — returns immediately if the entry already exists.
     *
     * Selection priority:
     *  1. Already recorded in daily_challenges → return that hand.
     *  2a. A community hand won by ≥ 2 distinct users, not yet used as a daily.
     *  2b. Fallback: any community hand won by ≥ 1 user, not yet used as a daily.
     *  3. Fallback: best-scoring seed from CANDIDATE_COUNT deterministic candidates,
     *     evaluated by an ace-accessibility heuristic.
     */
    @Transactional
    public Hand ensureDaily(LocalDate date, String drawMode) {

        // 1. Already selected?
        Hand hand = dailyChallengeRepo.findByDateAndMode(date, drawMode)
            .map(dc -> handRepo.findById(dc.getHandId()).orElse(null))
            .orElse(null);
        if (hand != null) return hand;

        // 2a. Prefer hands solved by multiple distinct users (quality signal)
        int winnerThreshold = PREFERRED_WINNERS;
        List<Hand> eligible = handRepo.findEligibleDailyHands(drawMode, winnerThreshold);
        if (eligible.isEmpty()) {
            // 2b. Fall back to any solved hand if the library is still small
            winnerThreshold = 1;
            eligible = handRepo.findEligibleDailyHands(drawMode, winnerThreshold);
        }
        if (!eligible.isEmpty()) {
            hand = eligible.get(0);
            dailyChallengeRepo.save(new DailyChallenge(date, drawMode, hand.getId()));
            log.info("Daily [{}] {}: promoted community hand {} (minWinners={})",
                     drawMode, date, hand.getId(), winnerThreshold);
            return hand;
        }

        // 3. Seeded fallback: pick the best ace-accessible hand from CANDIDATE_COUNT candidates
        long seed = selectBestSeed(date, drawMode);
        final long chosenSeed = seed;
        hand = handRepo.findByShuffleSeed(seed).orElseGet(() -> {
            Hand h = new Hand(chosenSeed, drawMode);
            return handRepo.save(h);
        });
        dailyChallengeRepo.save(new DailyChallenge(date, drawMode, hand.getId()));
        log.info("Daily [{}] {}: created seeded hand {} (aceScore={})",
                 drawMode, date, hand.getId(), scoreAceAccessibility(seed));
        return hand;
    }

    // ── Seed selection ─────────────────────────────────────────────────────────

    /**
     * Try {@link #CANDIDATE_COUNT} deterministic seed candidates derived from the date
     * and draw mode. Return the seed whose shuffled deck scores highest on ace
     * accessibility, favouring hands where aces surface early in draw-3 play.
     */
    static long selectBestSeed(LocalDate date, String drawMode) {
        long base      = deterministicSeed(date, drawMode);
        long bestSeed  = base;
        int  bestScore = scoreAceAccessibility(base);

        for (int i = 1; i < CANDIDATE_COUNT; i++) {
            // Spread candidates across the 32-bit seed space using a Fibonacci
            // hashing stride — produces well-distributed, non-overlapping seeds.
            long candidate = (base + (long) i * 2_654_435_761L) & 0xFFFFFFFFL;
            if (candidate == 0) candidate = 1; // zero is a degenerate xorshift32 fixed-point
            int score = scoreAceAccessibility(candidate);
            if (score > bestScore) {
                bestScore = score;
                bestSeed  = candidate;
            }
        }

        log.debug("Daily seed selection: date={} drawMode={} bestSeed={} score={}",
                  date, drawMode, bestSeed, bestScore);
        return bestSeed;
    }

    /**
     * Score how accessible the four aces are in the Klondike layout produced by the
     * given seed.  Higher = more accessible = better daily challenge candidate.
     *
     * <pre>
     * Per ace:
     *   +5  — face-up in the tableau immediately (deck indices 0,2,5,9,14,20,27)
     *   +3  — in the stock at a draw-3 directly-accessible position (stockPos % 3 == 2)
     *   +1  — anywhere else (face-down tableau or deeper stock)
     * </pre>
     *
     * Maximum possible score: 20 (all four aces face-up from the start).
     * A good daily hand typically scores ≥ 8.
     */
    static int scoreAceAccessibility(long seed) {
        int[] deck = SeededShuffle.shuffle(seed);

        // Build a fast membership set for face-up tableau positions
        boolean[] isFaceUp = new boolean[52];
        for (int idx : FACE_UP_INDICES) isFaceUp[idx] = true;

        int score = 0;
        outer:
        for (int aceId : ACE_IDS) {
            for (int i = 0; i < deck.length; i++) {
                if (deck[i] == aceId) {
                    if (isFaceUp[i]) {
                        score += 5; // immediately visible
                    } else if (i >= 28) {
                        int stockPos = i - 28; // 0-based position in the stock pile
                        // In draw-3, the card at stockPos % 3 == 2 is the one on top
                        // of each three-card draw group on the first pass.
                        score += (stockPos % 3 == 2) ? 3 : 1;
                    } else {
                        score += 1; // face-down in tableau — reachable but indirect
                    }
                    continue outer;
                }
            }
        }
        return score;
    }

    // ── Base deterministic seed ────────────────────────────────────────────────

    private static long deterministicSeed(LocalDate date, String drawMode) {
        long dateSeed     = date.toEpochDay();
        long drawModeSeed = "draw1".equals(drawMode) ? 1_000_000_007L : 999_999_937L;
        long raw = Math.abs((dateSeed * 6_364_136_223_846_793_005L + drawModeSeed) % 0x1_0000_0000L);
        return Math.max(1L, raw);
    }
}
