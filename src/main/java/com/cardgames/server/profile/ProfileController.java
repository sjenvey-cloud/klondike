package com.cardgames.server.profile;

import com.cardgames.server.auth.InvalidCredentialsException;
import com.cardgames.server.session.SessionRepository;
import com.cardgames.server.session.Session;
import com.cardgames.server.user.User;
import com.cardgames.server.user.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Tag(name = "Profile", description = "User profile, stats, records, password, and account management")
@RestController
@RequestMapping("/api/v1/profile")
public class ProfileController {

    private final UserRepository    userRepository;
    private final SessionRepository sessionRepository;
    private final AccountService    accountService;

    public ProfileController(UserRepository userRepository,
                             SessionRepository sessionRepository,
                             AccountService accountService) {
        this.userRepository    = userRepository;
        this.sessionRepository = sessionRepository;
        this.accountService    = accountService;
    }

    // ── DEV-81: GET /api/v1/profile ───────────────────────────────────────

    @Operation(summary = "Get the authenticated user's profile")
    @GetMapping
    public ResponseEntity<ProfileResponse> getProfile(Authentication auth) {
        User user = resolveUser(auth);
        return ResponseEntity.ok(toResponse(user));
    }

    // ── DEV-82: PATCH /api/v1/profile ─────────────────────────────────────

    @Operation(summary = "Update display name")
    @PatchMapping
    public ResponseEntity<ProfileResponse> patchProfile(
            @Valid @RequestBody PatchProfileRequest body,
            Authentication auth) {

        User user = resolveUser(auth);
        user.setDisplayName(body.displayName());
        user.setUsername(body.displayName()); // keep username in sync
        userRepository.save(user);
        return ResponseEntity.ok(toResponse(user));
    }

    // ── Change password: PATCH /api/v1/profile/password ──────────────────

    @Operation(summary = "Change password")
    @PatchMapping("/password")
    public ResponseEntity<Void> changePassword(
            @Valid @RequestBody ChangePasswordRequest body,
            Authentication auth) {

        int userId = (Integer) auth.getPrincipal();
        accountService.changePassword(userId, body.currentPassword(), body.newPassword());
        return ResponseEntity.noContent().build();
    }

    // ── Delete account: DELETE /api/v1/profile ────────────────────────────
    // All user data is removed via ON DELETE CASCADE (V14 migration).

    @Operation(summary = "Permanently delete account", description = "Requires password confirmation. All data removed via CASCADE.")
    @DeleteMapping
    public ResponseEntity<Void> deleteAccount(
            @Valid @RequestBody DeleteAccountRequest body,
            @org.springframework.web.bind.annotation.RequestHeader(
                value = "Authorization", required = false) String authHeader,
            Authentication auth) {

        int userId = (Integer) auth.getPrincipal();

        // DEV-201: extract bearer token for jti revocation inside AccountService
        String bearerToken = (authHeader != null && authHeader.startsWith("Bearer "))
            ? authHeader.substring(7) : null;

        accountService.deleteAccount(userId, body.password(), bearerToken);
        return ResponseEntity.noContent().build();
    }

    // ── DEV-150: GET /api/v1/profile/stats ───────────────────────────────

    @Operation(summary = "Get play statistics (games played, win rate, averages) by draw mode")
    @GetMapping("/stats")
    public ResponseEntity<StatsResponse> getStats(Authentication auth) {
        int userId = (Integer) auth.getPrincipal();
        List<Object[]> rows = sessionRepository.findStatsByDrawMode(userId);

        StatsResponse.DrawModeStats draw1 = StatsResponse.EMPTY;
        StatsResponse.DrawModeStats draw3 = StatsResponse.EMPTY;

        for (Object[] row : rows) {
            String mode     = (String) row[0];
            long   played   = ((Number) row[1]).longValue();
            long   wins     = ((Number) row[2]).longValue();
            double avgMoves = row[3] != null ? ((Number) row[3]).doubleValue() : 0.0;
            double avgTime  = row[4] != null ? ((Number) row[4]).doubleValue() : 0.0;
            double winRate  = played > 0 ? (double) wins / played : 0.0;
            StatsResponse.DrawModeStats s = new StatsResponse.DrawModeStats(
                (int) played, (int) wins, winRate, avgMoves, avgTime);
            if ("draw1".equals(mode)) draw1 = s;
            else if ("draw3".equals(mode)) draw3 = s;
        }

        return ResponseEntity.ok(new StatsResponse(draw1, draw3));
    }

    // ── DEV-151: GET /api/v1/profile/records ─────────────────────────────

    @Operation(summary = "Get personal best records (fewest moves, fastest time)")
    @GetMapping("/records")
    public ResponseEntity<RecordsResponse> getRecords(Authentication auth) {
        int userId = (Integer) auth.getPrincipal();
        PageRequest one = PageRequest.of(0, 1);

        List<Session> byMoves = sessionRepository.findTopWinByMoves(userId, one);
        List<Session> byTime  = sessionRepository.findTopWinByTime(userId, one);

        RecordsResponse.PersonalBest fewest = byMoves.isEmpty() ? null : toPersonalBest(byMoves.get(0));
        RecordsResponse.PersonalBest fastest = byTime.isEmpty() ? null : toPersonalBest(byTime.get(0));

        return ResponseEntity.ok(new RecordsResponse(fewest, fastest));
    }

    // ── DEV-281: GET /api/v1/profile/calendar?weeks=26&tzOffset=0 ─────────
    // Returns one ProfileCalendarEntry per day that had at least one session.
    // Daily-challenge sessions are excluded by findDailyHistory (daily_date IS NULL filter).
    // weeks defaults to 26 (≈6 months) to support the iOS month-nav back-limit.
    // tzOffset = minutes east of UTC so day boundaries align with the user's timezone.

    @Operation(summary = "Profile activity calendar heatmap",
               description = "Returns day-by-day games-played / games-won counts for the profile calendar.")
    @GetMapping("/calendar")
    public ResponseEntity<List<ProfileCalendarEntry>> getCalendar(
            @RequestParam(defaultValue = "26") int weeks,
            @RequestParam(defaultValue = "0")  int tzOffset,
            Authentication auth) {

        int userId = (Integer) auth.getPrincipal();
        int days = weeks * 7;

        // Shift the since boundary into UTC to align with the user's local day start
        LocalDateTime since = LocalDate.now().minusDays(days).atStartOfDay()
                                       .minusMinutes(tzOffset);

        List<Object[]> rows = sessionRepository.findDailyHistory(userId, since, tzOffset);
        List<ProfileCalendarEntry> result = new ArrayList<>();
        for (Object[] row : rows) {
            String date   = row[0].toString().substring(0, 10); // trim timestamp to yyyy-MM-dd
            int    played = ((Number) row[1]).intValue();
            int    won    = ((Number) row[2]).intValue();
            result.add(new ProfileCalendarEntry(date, played, won));
        }
        return ResponseEntity.ok(result);
    }

    // ── DEV-282: GET /api/v1/profile/sessions?date=yyyy-MM-dd&tzOffset=0 ──
    // Returns one ProfileDaySession per unique hand played on the given day.
    // Won sessions are preserved over abandoned ones via putIfAbsent deduplication.
    // Daily-challenge sessions are excluded (isDaily = false filter in findByUserIdAndStartedAtBetween).

    @Operation(summary = "Sessions played on a specific calendar day",
               description = "Returns deduplicated (one per hand) session summaries for the day-detail sheet.")
    @GetMapping("/sessions")
    public ResponseEntity<List<ProfileDaySession>> getSessionsByDate(
            @RequestParam String date,
            @RequestParam(defaultValue = "0") int tzOffset,
            Authentication auth) {

        int userId = (Integer) auth.getPrincipal();
        LocalDate localDate = LocalDate.parse(date);

        // Shift midnight boundaries from the user's local time into UTC
        LocalDateTime from = localDate.atStartOfDay().minusMinutes(tzOffset);
        LocalDateTime to   = localDate.plusDays(1).atStartOfDay().minusMinutes(tzOffset);

        // Query returns won sessions first (ORDER BY CASE WHEN won THEN 0 ELSE 1), so
        // putIfAbsent keeps the win when the user redealt the same hand on the same day.
        List<Session> all = sessionRepository.findByUserIdAndStartedAtBetween(userId, from, to);
        Map<Integer, Session> byHand = new LinkedHashMap<>();
        for (Session s : all) {
            byHand.putIfAbsent(s.getHandId(), s);
        }

        List<ProfileDaySession> result = byHand.values().stream()
                .map(s -> new ProfileDaySession(
                        s.getUuid(),
                        s.getDrawMode(),
                        s.getMoves(),
                        s.getTimeSeconds(),
                        "won".equals(s.getStatus()),
                        s.getCompletedAt() != null
                                ? s.getCompletedAt().toInstant(ZoneOffset.UTC)
                                : null))
                .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ── Exception handlers ────────────────────────────────────────────────

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<Map<String, String>> handleBadCredentials(InvalidCredentialsException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(Map.of("error", e.getMessage()));
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private User resolveUser(Authentication auth) {
        int userId = (Integer) auth.getPrincipal();
        return userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private RecordsResponse.PersonalBest toPersonalBest(Session s) {
        // Convert LocalDateTime (no timezone) to Instant (UTC) so Jackson
        // serialises as "...Z", which Foundation's .iso8601 decoder accepts.
        Instant completedAt = s.getCompletedAt() != null
                ? s.getCompletedAt().toInstant(ZoneOffset.UTC)
                : null;
        return new RecordsResponse.PersonalBest(
            s.getUuid(), s.getHandUuid(), s.getDrawMode(),
            s.getMoves(), s.getTimeSeconds(), completedAt);
    }

    private ProfileResponse toResponse(User user) {
        return new ProfileResponse(
            user.getId(),
            user.getUuid(),
            user.getDisplayName(),
            user.getEmail(),
            user.getdatecreated(),
            user.getlasthand(),
            user.getAvatarUrl()
        );
    }
}
