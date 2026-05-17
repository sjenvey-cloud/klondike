package com.cardgames.server.leaderboard;

import com.cardgames.server.session.Session;
import com.cardgames.server.session.SessionRepository;
import com.cardgames.server.shared.CursorUtil;
import com.cardgames.server.shared.OffsetCursor;
import com.cardgames.server.shared.PagedResponse;
import com.cardgames.server.user.User;
import com.cardgames.server.user.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * DEV-222: GET /api/v1/leaderboard/global — global ranked win leaderboard.
 * DEV-224: GET /api/v1/leaderboard/global/{uuid}/rank — caller's rank.
 *
 * Returns one entry per user (their best ranked won session) for the requested
 * period / drawMode / sort. Integer PKs never leave the server.
 */
@Tag(name = "Leaderboard", description = "Global and daily ranked leaderboards")
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
public class GlobalLeaderboardController {

    private final SessionRepository sessionRepo;
    private final UserRepository    userRepo;

    public GlobalLeaderboardController(SessionRepository sessionRepo, UserRepository userRepo) {
        this.sessionRepo = sessionRepo;
        this.userRepo    = userRepo;
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    /**
     * Maps a period string to a completed_at lower bound (UTC).
     * "all-time" uses a far-past sentinel so every won session qualifies.
     */
    private LocalDateTime sinceFor(String period) {
        return switch (period) {
            case "weekly"  -> LocalDateTime.now().minusDays(7);
            case "monthly" -> LocalDateTime.now().minusDays(30);
            default        -> LocalDateTime.of(2000, 1, 1, 0, 0); // all-time
        };
    }

    private GlobalLeaderboardEntry toEntry(int rank, Session s) {
        User user = userRepo.findById(s.getUserId()).orElse(null);
        String name = (user != null) ? user.getDisplayName() : "Unknown";
        UUID   uuid = (user != null) ? user.getUuid()        : null;
        return new GlobalLeaderboardEntry(rank, uuid, name, s.getMoves(), s.getTimeSeconds());
    }

    // ── DEV-222: Global leaderboard list ─────────────────────────────────

    /**
     * GET /api/v1/leaderboard/global
     *
     * Query params:
     *   period   = weekly | monthly | all-time  (default: weekly)
     *   drawMode = draw1  | draw3               (default: draw3)
     *   sort     = moves  | time                (default: moves)
     *
     * Returns up to 50 entries, one per user (their best session).
     */
    @Operation(summary = "Global leaderboard",
               description = "Best session per user for the given period/drawMode/sort. " +
                             "Cursor-paginated (offset-based). Default limit=50.")
    @GetMapping("/leaderboard/global")
    public ResponseEntity<PagedResponse<GlobalLeaderboardEntry>> getGlobalLeaderboard(
            @RequestParam(defaultValue = "weekly") String period,
            @RequestParam(defaultValue = "draw3")  String drawMode,
            @RequestParam(defaultValue = "moves")  String sort,
            @RequestParam(defaultValue = "50")     int limit,
            @RequestParam(required = false)        String cursor) {

        int offset = 0;
        if (cursor != null) {
            OffsetCursor oc = CursorUtil.decode(cursor, OffsetCursor.class);
            if (oc != null) offset = oc.offset();
        }

        LocalDateTime since = sinceFor(period);

        // Fetch limit+1 to detect whether another page exists
        List<Session> sessions = "time".equals(sort)
            ? sessionRepo.findGlobalLeaderboardByTimePage(drawMode, since, limit + 1, offset)
            : sessionRepo.findGlobalLeaderboardByMovesPage(drawMode, since, limit + 1, offset);

        boolean hasMore = sessions.size() > limit;
        List<Session> page = hasMore ? sessions.subList(0, limit) : sessions;

        List<GlobalLeaderboardEntry> items = new ArrayList<>();
        int rank = offset + 1;
        for (Session s : page) {
            items.add(toEntry(rank++, s));
        }

        String nextCursor = hasMore ? CursorUtil.encode(new OffsetCursor(offset + limit)) : null;
        return ResponseEntity.ok(new PagedResponse<>(items, nextCursor, hasMore));
    }

    // ── DEV-224: Caller's rank ────────────────────────────────────────────

    /**
     * GET /api/v1/leaderboard/global/{uuid}/rank
     *
     * Returns the given user's rank on the global board for the requested
     * period / drawMode / sort. 404 if the user has no qualifying win.
     *
     * Query params: period, drawMode, sort (same defaults as list endpoint).
     */
    @Operation(summary = "Get a user's global rank", description = "Returns 404 if the user has no qualifying win in the period.")
    @GetMapping("/leaderboard/global/{uuid}/rank")
    public ResponseEntity<GlobalLeaderboardEntry> getGlobalRank(
            @PathVariable UUID uuid,
            @RequestParam(defaultValue = "weekly") String period,
            @RequestParam(defaultValue = "draw3")  String drawMode,
            @RequestParam(defaultValue = "moves")  String sort,
            Authentication auth) {

        User user = userRepo.findByUuid(uuid).orElse(null);
        if (user == null) return ResponseEntity.notFound().build();

        LocalDateTime since = sinceFor(period);

        Optional<Session> best = "time".equals(sort)
            ? sessionRepo.findBestSessionByTime(user.getId(), drawMode, since)
            : sessionRepo.findBestSessionByMoves(user.getId(), drawMode, since);

        if (best.isEmpty()) return ResponseEntity.notFound().build();

        Session s = best.get();

        long above = "time".equals(sort)
            ? sessionRepo.countUsersRankedAboveByTime(drawMode, since, s.getTimeSeconds(), s.getMoves())
            : sessionRepo.countUsersRankedAboveByMoves(drawMode, since, s.getMoves(), s.getTimeSeconds());

        int rank = (int) above + 1;
        return ResponseEntity.ok(
            new GlobalLeaderboardEntry(rank, user.getUuid(), user.getDisplayName(),
                                       s.getMoves(), s.getTimeSeconds()));
    }
}
