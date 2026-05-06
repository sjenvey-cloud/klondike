package com.cardgames.server.profile;

import com.cardgames.server.auth.InvalidCredentialsException;
import com.cardgames.server.session.SessionRepository;
import com.cardgames.server.session.Session;
import com.cardgames.server.user.User;
import com.cardgames.server.user.UserRepository;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

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

    @GetMapping
    public ResponseEntity<ProfileResponse> getProfile(Authentication auth) {
        User user = resolveUser(auth);
        return ResponseEntity.ok(toResponse(user));
    }

    // ── DEV-82: PATCH /api/v1/profile ─────────────────────────────────────

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

    @DeleteMapping
    public ResponseEntity<Void> deleteAccount(
            @Valid @RequestBody DeleteAccountRequest body,
            Authentication auth) {

        int userId = (Integer) auth.getPrincipal();
        accountService.deleteAccount(userId, body.password());
        return ResponseEntity.noContent().build();
    }

    // ── DEV-150: GET /api/v1/profile/stats ───────────────────────────────

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
        return new RecordsResponse.PersonalBest(
            s.getId(), s.getHandId(), s.getDrawMode(),
            s.getMoves(), s.getTimeSeconds(), s.getCompletedAt());
    }

    private ProfileResponse toResponse(User user) {
        return new ProfileResponse(
            user.getId(),
            user.getDisplayName(),
            user.getEmail(),
            user.getdatecreated(),
            user.getlasthand()
        );
    }
}
