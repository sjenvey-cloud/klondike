package com.cardgames.server.daily;

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
     *  2. A previously-played (won) hand not yet used as a daily → promote it.
     *  3. Fallback: deterministic seed derived from date + draw mode.
     */
    @Transactional
    public Hand ensureDaily(LocalDate date, String drawMode) {

        // 1. Already selected?
        Hand hand = dailyChallengeRepo.findByDateAndMode(date, drawMode)
            .map(dc -> handRepo.findById(dc.getHandId()).orElse(null))
            .orElse(null);
        if (hand != null) return hand;

        // 2. Promote a previously-solved hand not yet used as a daily
        List<Hand> eligible = handRepo.findEligibleDailyHands(drawMode);
        if (!eligible.isEmpty()) {
            hand = eligible.get(0); // ORDER BY RANDOM() in the query
            dailyChallengeRepo.save(new DailyChallenge(date, drawMode, hand.getId()));
            log.info("Daily [{}] {}: promoted hand {}", drawMode, date, hand.getId());
            return hand;
        }

        // 3. Deterministic seed fallback
        long seed = deterministicSeed(date, drawMode);
        hand = handRepo.findByShuffleSeed(seed).orElseGet(() -> {
            Hand h = new Hand(seed, drawMode);
            return handRepo.save(h);
        });
        dailyChallengeRepo.save(new DailyChallenge(date, drawMode, hand.getId()));
        log.info("Daily [{}] {}: created seeded hand {}", drawMode, date, hand.getId());
        return hand;
    }

    // ── Same deterministic seed algorithm used by DailyController ─────────────

    private static long deterministicSeed(LocalDate date, String drawMode) {
        long dateSeed     = date.toEpochDay();
        long drawModeSeed = "draw1".equals(drawMode) ? 1_000_000_007L : 999_999_937L;
        long raw = Math.abs((dateSeed * 6_364_136_223_846_793_005L + drawModeSeed) % 0x1_0000_0000L);
        return Math.max(1L, raw);
    }
}
