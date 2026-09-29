package com.cardgames.server.session;

import com.cardgames.server.challenges.Challenge;
import com.cardgames.server.challenges.ChallengeRepository;
import com.cardgames.server.daily.DailyChallengeRepository;
import com.cardgames.server.game.GameState;
import com.cardgames.server.game.ReplayResult;
import com.cardgames.server.hand.Hand;
import com.cardgames.server.hand.HandRepository;
import com.cardgames.server.metrics.MetricsService;
import org.springframework.dao.DataIntegrityViolationException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import jakarta.transaction.Transactional;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Tag(name = "Sessions", description = "Create, complete, abandon, and resume game sessions")
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
public class SessionController {

    private static final Logger log = LoggerFactory.getLogger(SessionController.class);

    @Autowired SessionRepository        sessionRepository;
    @Autowired HandRepository           handRepository;
    @Autowired ChallengeRepository      challengeRepository;
    @Autowired DailyChallengeRepository dailyChallengeRepo;
    @Autowired CacheManager             cacheManager;
    @Autowired MetricsService           metricsService;

    // ── DEV-202: Active session ───────────────────────────────────────────

    /**
     * GET /api/v1/sessions/active
     *
     * Returns the most recent in-progress session for the authenticated user.
     * Used by the frontend on app boot to offer a resume-game prompt.
     * Returns 204 No Content if the user has no active session.
     */
    @Operation(summary = "Get active sessions", description = "Returns the current in-progress daily and random sessions for the authenticated user (null if none).")
    @GetMapping("/sessions/active")
    public ResponseEntity<ActiveSessionsResponse> getActiveSession(Authentication auth) {
        int userId = (Integer) auth.getPrincipal();

        // Look up daily and random active sessions independently so each screen
        // can offer its own resume prompt without the two types conflating.
        // DEV-252: include seed + turns so iOS can reconstruct game state without
        //          an extra round-trip to GET /api/v1/hands/{uuid}.
        ActiveSessionResponse daily = sessionRepository
            .findFirstByUserIdAndStatusAndIsDailyTrueOrderByStartedAtDesc(userId, Session.STATUS_ACTIVE)
            .flatMap(s -> handRepository.findById(s.getHandId())
                .map(h -> new ActiveSessionResponse(
                    s.getUuid(), s.getHandUuid(), s.getDrawMode(),
                    h.getShuffleSeed(), s.getTurns(), s.getMoves(), s.getTimeSeconds(), s.getStartedAt(), true,
                    s.getDailyDate() != null ? s.getDailyDate().toString() : null)))
            .orElse(null);

        ActiveSessionResponse random = sessionRepository
            .findFirstByUserIdAndStatusAndIsDailyFalseOrderByStartedAtDesc(userId, Session.STATUS_ACTIVE)
            .flatMap(s -> handRepository.findById(s.getHandId())
                .map(h -> new ActiveSessionResponse(
                    s.getUuid(), s.getHandUuid(), s.getDrawMode(),
                    h.getShuffleSeed(), s.getTurns(), s.getMoves(), s.getTimeSeconds(), s.getStartedAt(), false,
                    null)))
            .orElse(null);

        return ResponseEntity.ok(new ActiveSessionsResponse(daily, random));
    }

    // ── DEV-69: Create session ────────────────────────────────────────────

    /**
     * POST /api/v1/sessions
     * Body: { "handId": 42, "userId": 7 }
     *
     * Creates a new active session for the given hand and user.
     * Called once when the player starts a new game.
     */
    @Operation(summary = "Create a new game session")
    @PostMapping("/sessions")
    public ResponseEntity<CreateSessionResponse> createSession(@RequestBody CreateSessionRequest body) {
        log.info("createSession: handUuid={} userId={} isDaily={} dailyDate={} isRanked={}",
            body.handUuid(), body.userId(), body.isDaily(), body.dailyDate(), body.isRanked());

        Hand hand = handRepository.findByUuid(body.handUuid()).orElse(null);
        if (hand == null) return new ResponseEntity<>(HttpStatus.NOT_FOUND);

        Session session = new Session(hand.getId(), body.userId());
        session.setHandUuid(hand.getUuid());
        session.setDrawMode(hand.getDrawMode());
        if (body.clientId() != null) session.setClientId(body.clientId());

        boolean isRanked = true;
        if (body.isDaily() && body.dailyDate() != null) {
            LocalDate date = LocalDate.parse(body.dailyDate());
            session.setIsDaily(true);
            session.setDailyDate(date);

            // No practice paradigm: every daily attempt — today's OR any past day —
            // is ranked and can be replayed unlimited times to improve. The session is
            // tagged with its own daily_date, so each result lands on that day's
            // leaderboard, and DISTINCT ON keeps each user's best per metric.
            session.setIsRanked(true);
            log.info("createSession: daily branch — date={} drawMode={} (ranked)",
                date, hand.getDrawMode());
        }

        sessionRepository.save(session);
        metricsService.recordSessionStarted();
        log.info("createSession: saved session id={} isDaily={} dailyDate={} isRanked={} drawMode={}",
            session.getId(), session.isDaily(), session.getDailyDate(), session.isRanked(), session.getDrawMode());
        return new ResponseEntity<>(new CreateSessionResponse(session, isRanked), HttpStatus.CREATED);
    }

    // ── DEV-71: Complete session (win) ────────────────────────────────────

    /**
     * POST /api/v1/sessions/{uuid}/complete
     * Body: { "moves": 42, "timeSeconds": 180, "turns": "draw,wt:2,..." }
     *
     * Reproduces the hand from its seed, replays every move server-side,
     * and validates that the game was genuinely won. On success the session
     * is persisted as status=won. On failure HTTP 422 is returned and the
     * session record is NOT modified.
     */
    @Operation(summary = "Complete a session (win)", description = "Server-side replays the full move history to validate the win before persisting.")
    @Transactional
    @PostMapping("/sessions/{uuid}/complete")
    public ResponseEntity<CompleteSessionResponse> completeSession(
            @PathVariable UUID uuid,
            @RequestBody EndSessionRequest body) {

        Session session = sessionRepository.findByUuid(uuid).orElse(null);
        if (session == null) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }

        Hand hand = handRepository.findById(session.getHandId()).orElse(null);
        if (hand == null) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }

        GameState    state  = new GameState(hand.getShuffleSeed(), hand.getDrawMode());
        ReplayResult result = state.replay(body.turns());

        // Verify the replay reached a won state
        if (result.isValid() && !state.isWon()) {
            result = new ReplayResult(false,
                "Claimed win but replay did not reach a won state", result.getMoveCount());
        }

        if (!result.isValid()) {
            return new ResponseEntity<>(
                new CompleteSessionResponse(false, result.getMessage(), result.getMoveCount(), session),
                HttpStatus.UNPROCESSABLE_ENTITY
            );
        }

        // Demote any prior abandoned ranked sessions BEFORE mutating the session entity.
        // Hibernate auto-flushes dirty entities before executing a @Modifying JPQL query,
        // so if we modify the session first (status='won') and then call the demotion query,
        // Hibernate flushes the 'won' row to the DB first — triggering idx_one_ranked_daily
        // before the abandoned row has been cleared. Running demotion while the entity is
        // still clean avoids the flush-ordering problem entirely.
        if (session.isDaily() && session.isRanked() && session.getDailyDate() != null) {
            int demoted = sessionRepository.demoteAbandonedRankedSessions(
                session.getUserId(), session.getDailyDate(), session.getDrawMode(), session.getId());
            if (demoted > 0) {
                log.info("completeSession: demoted {} prior abandoned ranked session(s) for userId={} date={} drawMode={}",
                    demoted, session.getUserId(), session.getDailyDate(), session.getDrawMode());
            }
        }

        session.setStatus(Session.STATUS_WON);
        session.setMoves(body.moves());
        session.setTimeSeconds(body.timeSeconds());
        session.setTurns(body.turns());
        session.setCompletedAt(LocalDateTime.now());
        sessionRepository.save(session);
        metricsService.recordSessionCompleted();
        log.info("completeSession: saved win — id={} handId={} userId={} isDaily={} dailyDate={} isRanked={} moves={} timeSeconds={}",
            session.getId(), session.getHandId(), session.getUserId(),
            session.isDaily(), session.getDailyDate(), session.isRanked(),
            session.getMoves(), session.getTimeSeconds());

        // DEV-166: evict leaderboard cache when a ranked daily win is recorded
        if (session.isDaily() && session.isRanked() && session.getDailyDate() != null) {
            evictLeaderboard(session.getDailyDate().toString(), session.getDrawMode());
        }

        // DEV-163: auto-complete any challenge this session is the challenged side of
        settleChallengeIfPresent(session);

        return new ResponseEntity<>(
            new CompleteSessionResponse(true, "OK", result.getMoveCount(), session),
            HttpStatus.OK
        );
    }

    // ── DEV-72: Abandon session ───────────────────────────────────────────

    /**
     * POST /api/v1/sessions/{uuid}/abandon
     * Body: { "moves": 12, "timeSeconds": 60, "turns": "draw,wt:2,..." }
     *
     * Marks the session as abandoned and appends the "abandon" token to the
     * turns string. The move history is stored for analytics but not
     * validated — only completed sessions are replay-checked.
     */
    @Operation(summary = "Abandon a session", description = "Marks the session as abandoned and stores the partial move history.")
    @Transactional
    @PostMapping("/sessions/{uuid}/abandon")
    public ResponseEntity<Session> abandonSession(
            @PathVariable UUID uuid,
            @RequestBody EndSessionRequest body) {

        Session session = sessionRepository.findByUuid(uuid).orElse(null);
        if (session == null) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }

        String turns = (body.turns() != null && !body.turns().isBlank())
            ? body.turns() + ",abandon"
            : "abandon";

        // Demote any prior abandoned ranked sessions BEFORE mutating this session,
        // using the same flush-ordering discipline as completeSession.
        // Without this, saving a new ranked 'abandoned' session violates idx_one_ranked_daily
        // when a previous abandoned ranked session already occupies the same (user,date,drawMode) key.
        if (session.isDaily() && session.isRanked() && session.getDailyDate() != null) {
            int demoted = sessionRepository.demoteAbandonedRankedSessions(
                session.getUserId(), session.getDailyDate(), session.getDrawMode(), session.getId());
            if (demoted > 0) {
                log.info("abandonSession: demoted {} prior abandoned ranked session(s) for userId={} date={} drawMode={}",
                    demoted, session.getUserId(), session.getDailyDate(), session.getDrawMode());
            }
        }

        session.setStatus(Session.STATUS_ABANDONED);
        session.setMoves(body.moves());
        session.setTimeSeconds(body.timeSeconds());
        session.setTurns(turns);
        session.setCompletedAt(LocalDateTime.now());
        sessionRepository.save(session);

        // DEV-163: auto-complete any challenge this session is the challenged side of
        settleChallengeIfPresent(session);

        return new ResponseEntity<>(session, HttpStatus.OK);
    }

    // ── Offline mode: record a game played without a connection ───────────

    /**
     * POST /api/v1/sessions/offline
     *
     * Records a game that was played offline. Idempotent on {@code clientId}: the
     * client keeps a durable queue and retries this call until it succeeds, so it may
     * arrive more than once — a session already recorded for the clientId is returned
     * unchanged. The hand is ensured from its seed, a session is created (no prior
     * server session required), a win is replay-validated exactly like
     * {@link #completeSession}, and daily results are anti-cheat verified against the
     * official daily hand for that date + mode.
     */
    @Operation(summary = "Record a session played offline",
               description = "Idempotent on clientId; ensures the hand from its seed, validates a win by replay, and records it.")
    @Transactional
    @PostMapping("/sessions/offline")
    public ResponseEntity<CompleteSessionResponse> offlineSession(
            @RequestBody OfflineSessionRequest body, Authentication auth) {

        int userId = (Integer) auth.getPrincipal();
        if (body == null || body.clientId() == null) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }

        // 1. Idempotency — already recorded for this clientId?
        Session session = sessionRepository.findByClientId(body.clientId()).orElse(null);
        if (session != null && !Session.STATUS_ACTIVE.equals(session.getStatus())) {
            return new ResponseEntity<>(
                new CompleteSessionResponse(true, "Already recorded", session.getMoves(), session),
                HttpStatus.OK);
        }

        String drawMode = "draw1".equals(body.drawMode()) ? "draw1" : "draw3";

        // 2. Ensure the hand exists for this seed (idempotent).
        Hand hand = ensureHand(body.seed(), drawMode);
        if (hand == null) return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);

        // 3. Daily anti-cheat: the seed must match the official daily hand for that
        //    date + mode, else the daily/ranked flags are stripped (recorded as a
        //    normal game) so a spoofed seed can't top the daily leaderboard.
        boolean   isDaily   = false;
        LocalDate dailyDate = null;
        if (body.isDaily() && body.dailyDate() != null) {
            LocalDate date = LocalDate.parse(body.dailyDate());
            Hand officialDaily = dailyChallengeRepo.findByDateAndMode(date, drawMode)
                .flatMap(dc -> handRepository.findById(dc.getHandId()))
                .orElse(null);
            if (officialDaily != null && officialDaily.getId() == hand.getId()) {
                isDaily   = true;
                dailyDate = date;
            }
        }

        // 4. Reuse the placeholder session (if any) or create a fresh one, keyed by clientId.
        if (session == null) session = new Session(hand.getId(), userId);
        session.setClientId(body.clientId());
        session.setHandUuid(hand.getUuid());
        session.setDrawMode(drawMode);
        session.setIsDaily(isDaily);
        session.setDailyDate(dailyDate);
        session.setIsRanked(true);   // matches createSession (non-daily sessions are ranked too)
        session.setStatus(Session.STATUS_ACTIVE);
        session.setMoves(body.moves());
        session.setTimeSeconds(body.timeSeconds());

        boolean won = "won".equalsIgnoreCase(body.status());

        if (won) {
            GameState state = new GameState(hand.getShuffleSeed(), drawMode);
            ReplayResult result = state.replay(body.turns());
            if (result.isValid() && !state.isWon()) {
                result = new ReplayResult(false,
                    "Claimed win but replay did not reach a won state", result.getMoveCount());
            }
            if (!result.isValid()) {
                return new ResponseEntity<>(
                    new CompleteSessionResponse(false, result.getMessage(), result.getMoveCount(), session),
                    HttpStatus.UNPROCESSABLE_ENTITY);
            }
        }

        // Persist as ACTIVE first so the row has an id and is NOT yet in the ranked
        // index, then demote prior abandoned ranked rows, then flip to the terminal
        // status — the same flush-ordering discipline as completeSession/abandon.
        session.setTurns(body.turns());
        sessionRepository.save(session);

        if (isDaily && session.isRanked()) {
            sessionRepository.demoteAbandonedRankedSessions(userId, dailyDate, drawMode, session.getId());
        }

        if (won) {
            session.setStatus(Session.STATUS_WON);
            session.setCompletedAt(LocalDateTime.now());
            sessionRepository.save(session);
            metricsService.recordSessionCompleted();
            if (isDaily && session.isRanked()) {
                evictLeaderboard(dailyDate.toString(), drawMode);
            }
            settleChallengeIfPresent(session);
        } else {
            String turns = (body.turns() != null && !body.turns().isBlank())
                ? (body.turns().endsWith("abandon") ? body.turns() : body.turns() + ",abandon")
                : "abandon";
            session.setStatus(Session.STATUS_ABANDONED);
            session.setTurns(turns);
            session.setCompletedAt(LocalDateTime.now());
            sessionRepository.save(session);
            settleChallengeIfPresent(session);
        }

        log.info("offlineSession: recorded {} — clientId={} handId={} userId={} isDaily={} dailyDate={} moves={} time={}",
            session.getStatus(), body.clientId(), hand.getId(), userId, isDaily, dailyDate, body.moves(), body.timeSeconds());

        return new ResponseEntity<>(
            new CompleteSessionResponse(true, "OK", body.moves(), session), HttpStatus.OK);
    }

    /** Idempotently return (or create) the hand for a given seed + draw mode. */
    private Hand ensureHand(long seed, String drawMode) {
        Hand hand = handRepository.findByShuffleSeed(seed).orElse(null);
        if (hand != null) return hand;
        try {
            return handRepository.save(new Hand(seed, drawMode));
        } catch (DataIntegrityViolationException e) {
            return handRepository.findByShuffleSeed(seed).orElse(null);
        }
    }

    // ── DEV-338: Save in-progress state for cross-device resume ───────────

    /**
     * POST /api/v1/sessions/{uuid}/progress
     * Body: { "moves": 12, "timeSeconds": 95, "turns": "draw,wt:2,..." }
     *
     * Persists the partial move history + elapsed time of an ACTIVE session so it
     * can be resumed on another device (web ↔ iOS). Lightweight snapshot saved when
     * the game is paused/backgrounded — no win validation. No-op once the session is
     * completed or abandoned.
     */
    @Operation(summary = "Save in-progress session state",
               description = "Snapshot of an active session's moves + elapsed time for cross-device resume.")
    @Transactional
    @PostMapping("/sessions/{uuid}/progress")
    public ResponseEntity<Void> saveProgress(
            @PathVariable UUID uuid,
            @RequestBody EndSessionRequest body,
            Authentication auth) {

        int userId = (Integer) auth.getPrincipal();
        Session session = sessionRepository.findByUuid(uuid).orElse(null);
        if (session == null) return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        if (session.getUserId() != userId) return new ResponseEntity<>(HttpStatus.FORBIDDEN);

        // Only snapshot sessions still in progress; ignore once terminal.
        if (Session.STATUS_ACTIVE.equals(session.getStatus())) {
            session.setMoves(body.moves());
            session.setTimeSeconds(body.timeSeconds());
            if (body.turns() != null) session.setTurns(body.turns());
            sessionRepository.save(session);
        }
        return ResponseEntity.noContent().build();
    }

    // ── DEV-166: cache eviction ───────────────────────────────────────────
    // NOTE: @CacheEvict cannot be used here because Spring AOP proxying is
    // bypassed on self-invocation (calling a method from within the same bean).
    // Instead we evict programmatically via CacheManager.

    private void evictLeaderboard(String date, String drawMode) {
        Cache cache = cacheManager.getCache("leaderboard");
        if (cache == null) return;
        cache.evict(date + ":moves:" + drawMode);
        cache.evict(date + ":time:"  + drawMode);
    }

    // ── DEV-163: helper ───────────────────────────────────────────────────

    private void settleChallengeIfPresent(Session session) {
        challengeRepository.findByChallengedSessionId(session.getId()).ifPresent(c -> {
            if (Challenge.STATUS_ACCEPTED.equals(c.getStatus())) {
                c.setStatus(Challenge.STATUS_COMPLETED);
                c.setCompletedAt(session.getCompletedAt());
                challengeRepository.save(c);
            }
        });
    }
}
