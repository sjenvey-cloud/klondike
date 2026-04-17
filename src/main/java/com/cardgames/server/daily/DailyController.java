package com.cardgames.server.daily;

import com.cardgames.server.game.SeededShuffle;
import com.cardgames.server.hand.Hand;
import com.cardgames.server.hand.HandRepository;
import com.cardgames.server.hand.HandResponse;
import com.cardgames.server.session.Session;
import com.cardgames.server.session.SessionRepository;
import com.cardgames.server.user.User;
import com.cardgames.server.user.UserRepository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@CrossOrigin(origins = {
    "http://localhost:4200",
    "http://localhost:5173",
    "https://dbk2b6k1kyjsy.cloudfront.net",
    "https://d2fbehwb6bp7kq.cloudfront.net",
    "https://klondikepro.app",
    "https://www.klondikepro.app"
})
@RestController
@RequestMapping("/api/v1")
public class DailyController {

    private final HandRepository           handRepo;
    private final SessionRepository        sessionRepo;
    private final UserRepository           userRepo;
    private final DailyChallengeRepository dailyChallengeRepo;

    public DailyController(HandRepository handRepo,
                           SessionRepository sessionRepo,
                           UserRepository userRepo,
                           DailyChallengeRepository dailyChallengeRepo) {
        this.handRepo           = handRepo;
        this.sessionRepo        = sessionRepo;
        this.userRepo           = userRepo;
        this.dailyChallengeRepo = dailyChallengeRepo;
    }

    /**
     * GET /api/v1/daily?drawMode=draw3
     *
     * Returns today's daily hand. Selection priority:
     *  1. Already recorded in daily_challenges for today → use that hand.
     *  2. A previously-played (won) hand not yet used as a daily → promote it,
     *     retroactively marking its won sessions so the leaderboard is pre-populated.
     *  3. Fallback: deterministic seed derived from date + draw mode.
     *
     * Every user receives the same hand for the same UTC date and draw mode.
     */
    @Transactional
    @GetMapping("/daily")
    public ResponseEntity<DailyHandResponse> getDaily(
            @RequestParam(defaultValue = "draw3") String drawMode,
            Authentication auth) {

        LocalDate today = LocalDate.now();

        // 1. Already selected for today?
        Hand hand = dailyChallengeRepo.findByDateAndMode(today, drawMode)
            .map(dc -> handRepo.findById(dc.getHandId()).orElse(null))
            .orElse(null);

        // 2. Promote a previously-solved hand that hasn't been a daily yet
        if (hand == null) {
            List<Hand> eligible = handRepo.findEligibleDailyHands(drawMode);
            if (!eligible.isEmpty()) {
                hand = eligible.get(0); // already ORDER BY RANDOM()
                dailyChallengeRepo.save(new DailyChallenge(today, drawMode, hand.getId()));
                // Pre-populate leaderboard with prior wins on this hand
                sessionRepo.markWonSessionsAsDaily(hand.getId(), today);
            }
        }

        // 3. Fallback: deterministic seed
        if (hand == null) {
            long seed = deterministicSeed(today, drawMode);
            hand = handRepo.findByShuffleSeed(seed).orElseGet(() -> {
                Hand h = new Hand(seed, drawMode);
                return handRepo.save(h);
            });
            dailyChallengeRepo.save(new DailyChallenge(today, drawMode, hand.getId()));
        }

        int[] cards = SeededShuffle.shuffle(hand.getShuffleSeed());
        HandResponse handResponse = new HandResponse(hand.getId(), hand.getShuffleSeed(), cards, drawMode);

        // Check if authenticated user has used their ranked attempt today
        boolean userHasRankedAttempt = false;
        if (auth != null) {
            int userId = (Integer) auth.getPrincipal();
            userHasRankedAttempt = sessionRepo
                .existsByUserIdAndDailyDateAndDrawModeAndIsRankedTrueAndStatusIn(
                    userId, today, drawMode,
                    new String[]{ Session.STATUS_WON, Session.STATUS_ABANDONED });
        }

        return ResponseEntity.ok(new DailyHandResponse(handResponse, userHasRankedAttempt));
    }

    /**
     * GET /api/v1/leaderboard/daily/{date}/{sort}
     * Top 50 ranked wins for the given daily date and draw mode.
     * Deduplicated to one entry per user (their best score).
     */
    @Cacheable(cacheNames = "leaderboard", key = "#date + ':' + #sort + ':' + #drawMode")
    @GetMapping("/leaderboard/daily/{date}/{sort}")
    public ResponseEntity<List<LeaderboardEntry>> getDailyLeaderboard(
            @PathVariable String date,
            @PathVariable String sort,
            @RequestParam(defaultValue = "draw3") String drawMode) {

        LocalDate localDate = LocalDate.parse(date);
        List<Session> sessions = sessionRepo.findDailyLeaderboard(localDate, drawMode);

        // Sort preference
        if ("time".equals(sort)) {
            sessions = sessions.stream()
                .sorted(Comparator.comparingInt(Session::getTimeSeconds)
                                  .thenComparingInt(Session::getMoves))
                .toList();
        }

        // Deduplicate: keep only best session per user (list is already ordered best-first)
        Map<Integer, Session> bestByUser = new LinkedHashMap<>();
        for (Session s : sessions) {
            bestByUser.putIfAbsent(s.getUserId(), s);
        }

        List<LeaderboardEntry> board = new ArrayList<>();
        int rank = 1;
        for (Session s : bestByUser.values()) {
            User user = userRepo.findById(s.getUserId()).orElse(null);
            String name = (user != null) ? user.getDisplayName() : "Unknown";
            board.add(new LeaderboardEntry(rank++, s.getUserId(), name, s.getMoves(), s.getTimeSeconds()));
            if (board.size() == 50) break;
        }
        return ResponseEntity.ok(board);
    }

    /**
     * GET /api/v1/leaderboard/daily/{date}/{userId}/{sort}
     * Single user's rank for a given daily date.
     */
    @GetMapping("/leaderboard/daily/{date}/{userId}/{sort}")
    public ResponseEntity<LeaderboardEntry> getUserDailyRank(
            @PathVariable String date,
            @PathVariable int userId,
            @PathVariable String sort,
            @RequestParam(defaultValue = "draw3") String drawMode) {

        LocalDate localDate = LocalDate.parse(date);
        List<Session> sessions = sessionRepo.findDailyLeaderboard(localDate, drawMode);

        if ("time".equals(sort)) {
            sessions = sessions.stream()
                .sorted(Comparator.comparingInt(Session::getTimeSeconds)
                                  .thenComparingInt(Session::getMoves))
                .toList();
        }

        // Deduplicate same as leaderboard
        Map<Integer, Session> bestByUser = new LinkedHashMap<>();
        for (Session s : sessions) bestByUser.putIfAbsent(s.getUserId(), s);

        List<Integer> ranked = new ArrayList<>(bestByUser.keySet());
        int idx = ranked.indexOf(userId);
        if (idx < 0) return ResponseEntity.notFound().build();

        Session s = bestByUser.get(userId);
        User user = userRepo.findById(userId).orElse(null);
        String name = (user != null) ? user.getDisplayName() : "Unknown";
        return ResponseEntity.ok(new LeaderboardEntry(idx + 1, userId, name, s.getMoves(), s.getTimeSeconds()));
    }

    /**
     * GET /api/v1/profile/{userId}/history?days=35&tzOffset=60
     * tzOffset = minutes east of UTC (e.g. 60 for BST, -300 for US Eastern).
     */
    @GetMapping("/profile/{userId}/history")
    public ResponseEntity<List<DayHistory>> getProfileHistory(
            @PathVariable int userId,
            @RequestParam(defaultValue = "35") int days,
            @RequestParam(defaultValue = "0")  int tzOffset) {

        // Shift "since" boundary into UTC so it aligns with the user's local day
        LocalDateTime since = LocalDate.now().minusDays(days).atStartOfDay()
                                       .minusMinutes(tzOffset);
        List<Object[]> rows = sessionRepo.findDailyHistory(userId, since, tzOffset);

        List<DayHistory> result = new ArrayList<>();
        for (Object[] row : rows) {
            String day = row[0].toString().substring(0, 10);
            int played = ((Number) row[1]).intValue();
            int won    = ((Number) row[2]).intValue();
            result.add(new DayHistory(day, played, won));
        }
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/v1/profile/{userId}/sessions?date=2026-04-01&tzOffset=60
     * tzOffset = minutes east of UTC — shifts the day boundary into the user's timezone.
     */
    @GetMapping("/profile/{userId}/sessions")
    public ResponseEntity<List<Session>> getSessionsByDate(
            @PathVariable int userId,
            @RequestParam String date,
            @RequestParam(defaultValue = "0") int tzOffset) {

        LocalDate localDate = LocalDate.parse(date);
        // Shift midnight boundaries from user's local time into UTC
        LocalDateTime from = localDate.atStartOfDay().minusMinutes(tzOffset);
        LocalDateTime to   = localDate.plusDays(1).atStartOfDay().minusMinutes(tzOffset);

        // Deduplicate by hand: keep the most recent session per hand (list is DESC by startedAt)
        List<Session> all = sessionRepo.findByUserIdAndStartedAtBetween(userId, from, to);
        Map<Integer, Session> byHand = new LinkedHashMap<>();
        for (Session s : all) {
            byHand.putIfAbsent(s.getHandId(), s);
        }
        return ResponseEntity.ok(new ArrayList<>(byHand.values()));
    }

    // ── Fallback seed derivation (used only when no pre-played hand exists) ──

    private long deterministicSeed(LocalDate date, String drawMode) {
        long dateSeed     = date.toEpochDay();
        long drawModeSeed = "draw1".equals(drawMode) ? 1_000_000_007L : 999_999_937L;
        long raw = Math.abs((dateSeed * 6_364_136_223_846_793_005L + drawModeSeed) % 0x1_0000_0000L);
        return Math.max(1L, raw);
    }
}
