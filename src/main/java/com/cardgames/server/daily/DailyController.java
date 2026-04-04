package com.cardgames.server.daily;

import com.cardgames.server.game.SeededShuffle;
import com.cardgames.server.hand.Hand;
import com.cardgames.server.hand.HandRepository;
import com.cardgames.server.hand.HandResponse;
import com.cardgames.server.session.Session;
import com.cardgames.server.session.SessionRepository;
import com.cardgames.server.user.User;
import com.cardgames.server.user.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@CrossOrigin(origins = {
    "http://localhost:3000",
    "http://localhost:4200",
    "http://localhost:5173",
    "https://dbk2b6k1kyjsy.cloudfront.net"
})
@RestController
@RequestMapping("/api/v1")
public class DailyController {

    private final HandRepository    handRepo;
    private final SessionRepository sessionRepo;
    private final UserRepository    userRepo;

    public DailyController(HandRepository handRepo,
                           SessionRepository sessionRepo,
                           UserRepository userRepo) {
        this.handRepo    = handRepo;
        this.sessionRepo = sessionRepo;
        this.userRepo    = userRepo;
    }

    /**
     * GET /api/v1/daily?drawMode=draw3
     * DEV-112: Returns today's daily hand for the given draw mode.
     * Seed is derived deterministically from the date and draw mode.
     */
    @GetMapping("/daily")
    public ResponseEntity<DailyHandResponse> getDaily(
            @RequestParam(defaultValue = "draw3") String drawMode,
            Authentication auth) {

        long seed = dailySeed(LocalDate.now(), drawMode);

        // Find or create the daily hand for this seed
        Hand hand = handRepo.findByShuffleSeed(seed).orElseGet(() -> {
            Hand h = new Hand(seed, drawMode);
            return handRepo.save(h);
        });

        int[] cards = SeededShuffle.shuffle(seed);
        HandResponse handResponse = new HandResponse(hand.getId(), seed, cards, drawMode);

        // Check if authenticated user has used their ranked attempt
        boolean userHasRankedAttempt = false;
        if (auth != null) {
            int userId = (Integer) auth.getPrincipal();
            userHasRankedAttempt = sessionRepo
                .existsByUserIdAndDailyDateAndDrawModeAndIsRankedTrueAndStatusIn(
                    userId, LocalDate.now(), drawMode,
                    new String[]{ Session.STATUS_WON, Session.STATUS_ABANDONED });
        }

        return ResponseEntity.ok(new DailyHandResponse(handResponse, userHasRankedAttempt));
    }

    /**
     * GET /api/v1/leaderboard/daily/{date}/{sort}
     * Top 50 ranked wins for the given daily date and draw mode.
     */
    @GetMapping("/leaderboard/daily/{date}/{sort}")
    public ResponseEntity<List<LeaderboardEntry>> getDailyLeaderboard(
            @PathVariable String date,
            @PathVariable String sort,
            @RequestParam(defaultValue = "draw3") String drawMode) {

        LocalDate localDate = LocalDate.parse(date);
        List<Session> sessions = sessionRepo.findDailyLeaderboard(localDate, drawMode);

        // Sort: moves ASC is default; time ASC if requested
        if ("time".equals(sort)) {
            sessions = sessions.stream()
                .sorted((a, b) -> Integer.compare(a.getTimeSeconds(), b.getTimeSeconds()))
                .toList();
        }

        List<LeaderboardEntry> board = new ArrayList<>();
        for (int i = 0; i < sessions.size(); i++) {
            Session s = sessions.get(i);
            User user = userRepo.findById(s.getUserId()).orElse(null);
            String name = (user != null) ? user.getDisplayName() : "Unknown";
            board.add(new LeaderboardEntry(i + 1, s.getUserId(), name, s.getMoves(), s.getTimeSeconds()));
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
                .sorted((a, b) -> Integer.compare(a.getTimeSeconds(), b.getTimeSeconds()))
                .toList();
        }

        for (int i = 0; i < sessions.size(); i++) {
            if (sessions.get(i).getUserId() == userId) {
                Session s = sessions.get(i);
                User user = userRepo.findById(userId).orElse(null);
                String name = (user != null) ? user.getDisplayName() : "Unknown";
                return ResponseEntity.ok(
                    new LeaderboardEntry(i + 1, userId, name, s.getMoves(), s.getTimeSeconds()));
            }
        }
        return ResponseEntity.notFound().build();
    }

    /**
     * GET /api/v1/profile/{userId}/history?days=35
     * DEV-99: Activity history grouped by day.
     */
    @GetMapping("/profile/{userId}/history")
    public ResponseEntity<List<DayHistory>> getProfileHistory(
            @PathVariable int userId,
            @RequestParam(defaultValue = "35") int days) {

        LocalDateTime since = LocalDate.now().minusDays(days).atStartOfDay();
        List<Object[]> rows = sessionRepo.findDailyHistory(userId, since);

        List<DayHistory> result = new ArrayList<>();
        for (Object[] row : rows) {
            String day     = row[0].toString().substring(0, 10);
            int played     = ((Number) row[1]).intValue();
            int won        = ((Number) row[2]).intValue();
            result.add(new DayHistory(day, played, won));
        }
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/v1/profile/{userId}/sessions?date=2026-04-01
     * DEV-100: Sessions for a specific calendar day.
     */
    @GetMapping("/profile/{userId}/sessions")
    public ResponseEntity<List<Session>> getSessionsByDate(
            @PathVariable int userId,
            @RequestParam String date) {

        LocalDate localDate = LocalDate.parse(date);
        LocalDateTime from = localDate.atStartOfDay();
        LocalDateTime to   = localDate.plusDays(1).atStartOfDay();
        List<Session> sessions = sessionRepo.findByUserIdAndStartedAtBetween(userId, from, to);
        return ResponseEntity.ok(sessions);
    }

    // ── Daily seed derivation ─────────────────────────────────────────────

    private long dailySeed(LocalDate date, String drawMode) {
        long dateSeed     = date.toEpochDay();
        long drawModeSeed = "draw1".equals(drawMode) ? 1_000_000_007L : 999_999_937L;
        long raw = Math.abs((dateSeed * 6_364_136_223_846_793_005L + drawModeSeed) % 0x1_0000_0000L);
        return Math.max(1L, raw); // exclude 0 (xorshift degenerate point)
    }
}
