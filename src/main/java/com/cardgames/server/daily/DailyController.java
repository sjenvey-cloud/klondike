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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

// Note: deterministicSeed() has been moved to DailyGeneratorService.

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
    private final DailyGeneratorService    dailyGenerator;

    public DailyController(HandRepository handRepo,
                           SessionRepository sessionRepo,
                           UserRepository userRepo,
                           DailyChallengeRepository dailyChallengeRepo,
                           DailyGeneratorService dailyGenerator) {
        this.handRepo           = handRepo;
        this.sessionRepo        = sessionRepo;
        this.userRepo           = userRepo;
        this.dailyChallengeRepo = dailyChallengeRepo;
        this.dailyGenerator     = dailyGenerator;
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
    @GetMapping("/daily")
    public ResponseEntity<DailyHandResponse> getDaily(
            @RequestParam(defaultValue = "draw3") String drawMode,
            Authentication auth) {

        LocalDate today = LocalDate.now();

        // Delegate selection/creation to the shared service (also used by the scheduler).
        Hand hand = dailyGenerator.ensureDaily(today, drawMode);

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
     * Top 50 wins for the given day's daily hand, deduplicated to one entry per user.
     *
     * Looks up the authoritative hand via daily_challenges, then filters to
     * sessions that were ranked daily-challenge attempts on that specific date.
     * This excludes casual (non-daily) replays of the same hand.
     */
    @GetMapping("/leaderboard/daily/{date}/{sort}")
    public ResponseEntity<List<LeaderboardEntry>> getDailyLeaderboard(
            @PathVariable String date,
            @PathVariable String sort,
            @RequestParam(defaultValue = "draw3") String drawMode) {

        LocalDate localDate = LocalDate.parse(date);

        // Look up the authoritative hand for this date from daily_challenges
        Optional<DailyChallenge> dc = dailyChallengeRepo.findByDateAndMode(localDate, drawMode);
        if (dc.isEmpty()) return ResponseEntity.ok(List.of());

        // Only ranked daily-challenge wins for this specific hand + date
        List<Session> sessions = sessionRepo.findRankedDailyWinsByHand(dc.get().getHandId(), localDate);

        if ("time".equals(sort)) {
            sessions = sessions.stream()
                .sorted(Comparator.comparingInt(Session::getTimeSeconds)
                                  .thenComparingInt(Session::getMoves))
                .toList();
        }

        Map<Integer, Session> bestByUser = new LinkedHashMap<>();
        for (Session s : sessions) bestByUser.putIfAbsent(s.getUserId(), s);

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

        Optional<DailyChallenge> dc = dailyChallengeRepo.findByDateAndMode(localDate, drawMode);
        if (dc.isEmpty()) return ResponseEntity.notFound().build();

        // Only ranked daily-challenge wins for this specific hand + date
        List<Session> sessions = sessionRepo.findRankedDailyWinsByHand(dc.get().getHandId(), localDate);

        if ("time".equals(sort)) {
            sessions = sessions.stream()
                .sorted(Comparator.comparingInt(Session::getTimeSeconds)
                                  .thenComparingInt(Session::getMoves))
                .toList();
        }

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
     * GET /api/v1/daily/calendar?drawMode=draw3&months=4
     * Returns daily challenge entries for the past N months, with the
     * authenticated user's status for each day ("won" | "played" | "not_played").
     * NOTE: must be declared before /daily/{date} so the literal "calendar"
     * segment takes priority over the path-variable pattern.
     */
    @GetMapping("/daily/calendar")
    public ResponseEntity<List<DailyCalendarEntry>> getDailyCalendar(
            @RequestParam(defaultValue = "draw3") String drawMode,
            @RequestParam(defaultValue = "4")    int months,
            Authentication auth) {

        LocalDate today = LocalDate.now();
        LocalDate since = today.minusMonths(months - 1).withDayOfMonth(1);

        List<DailyChallenge> challenges =
            dailyChallengeRepo.findByDrawModeAndDateRange(drawMode, since, today);

        if (challenges.isEmpty()) return ResponseEntity.ok(List.of());

        // Determine the authenticated user's status per hand.
        // Only daily-challenge sessions (is_daily=true) count — casual replays of the
        // same hand must not affect the calendar dot / played / won indicator.
        Map<Integer, String> statusByHandId = new HashMap<>();
        if (auth != null) {
            int userId = (Integer) auth.getPrincipal();
            List<Integer> handIds = challenges.stream()
                .map(DailyChallenge::getHandId).collect(Collectors.toList());
            List<Session> sessions = sessionRepo.findDailySessionsByUserIdAndHandIdIn(userId, handIds);
            for (Session s : sessions) {
                String cur = statusByHandId.getOrDefault(s.getHandId(), "not_played");
                if ("won".equals(s.getStatus())) {
                    statusByHandId.put(s.getHandId(), "won");
                } else if (!"won".equals(cur)) {
                    statusByHandId.put(s.getHandId(), "played");
                }
            }
        }

        List<DailyCalendarEntry> result = challenges.stream()
            .map(dc -> new DailyCalendarEntry(
                dc.getChallengeDate().toString(),
                dc.getHandId(),
                dc.getDrawMode(),
                statusByHandId.getOrDefault(dc.getHandId(), "not_played")))
            .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/v1/daily/{date}?drawMode=draw3
     * Returns the daily hand for a specific past date — for practice replay.
     * Always returns userHasRankedAttempt=true so the game starts unranked.
     */
    @GetMapping("/daily/{date}")
    public ResponseEntity<DailyHandResponse> getDailyByDate(
            @PathVariable String date,
            @RequestParam(defaultValue = "draw3") String drawMode) {

        LocalDate localDate;
        try {
            localDate = LocalDate.parse(date);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
        if (localDate.isAfter(LocalDate.now())) return ResponseEntity.badRequest().build();

        Hand hand = dailyChallengeRepo.findByDateAndMode(localDate, drawMode)
            .map(dc -> handRepo.findById(dc.getHandId()).orElse(null))
            .orElse(null);
        if (hand == null) return ResponseEntity.notFound().build();

        int[] cards = SeededShuffle.shuffle(hand.getShuffleSeed());
        HandResponse handResponse = new HandResponse(
            hand.getId(), hand.getShuffleSeed(), cards, drawMode);
        // Past challenges are always practice (unranked)
        return ResponseEntity.ok(new DailyHandResponse(handResponse, true));
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

}
