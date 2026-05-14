package com.cardgames.server.session;

import com.cardgames.server.challenges.Challenge;
import com.cardgames.server.challenges.ChallengeRepository;
import com.cardgames.server.game.GameState;
import com.cardgames.server.game.ReplayResult;
import com.cardgames.server.hand.Hand;
import com.cardgames.server.hand.HandRepository;
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

    @Autowired SessionRepository   sessionRepository;
    @Autowired HandRepository      handRepository;
    @Autowired ChallengeRepository challengeRepository;
    @Autowired CacheManager        cacheManager;

    // ── DEV-202: Active session ───────────────────────────────────────────

    /**
     * GET /api/v1/sessions/active
     *
     * Returns the most recent in-progress session for the authenticated user.
     * Used by the frontend on app boot to offer a resume-game prompt.
     * Returns 204 No Content if the user has no active session.
     */
    @GetMapping("/sessions/active")
    public ResponseEntity<ActiveSessionsResponse> getActiveSession(Authentication auth) {
        int userId = (Integer) auth.getPrincipal();

        // Look up daily and random active sessions independently so each screen
        // can offer its own resume prompt without the two types conflating.
        ActiveSessionResponse daily = sessionRepository
            .findFirstByUserIdAndStatusAndIsDailyTrueOrderByStartedAtDesc(userId, Session.STATUS_ACTIVE)
            .map(s -> new ActiveSessionResponse(
                s.getUuid(), s.getHandUuid(), s.getDrawMode(), s.getMoves(), s.getStartedAt(), true))
            .orElse(null);

        ActiveSessionResponse random = sessionRepository
            .findFirstByUserIdAndStatusAndIsDailyFalseOrderByStartedAtDesc(userId, Session.STATUS_ACTIVE)
            .map(s -> new ActiveSessionResponse(
                s.getUuid(), s.getHandUuid(), s.getDrawMode(), s.getMoves(), s.getStartedAt(), false))
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
    @PostMapping("/sessions")
    public ResponseEntity<CreateSessionResponse> createSession(@RequestBody CreateSessionRequest body) {
        log.info("createSession: handUuid={} userId={} isDaily={} dailyDate={} isRanked={}",
            body.handUuid(), body.userId(), body.isDaily(), body.dailyDate(), body.isRanked());

        Hand hand = handRepository.findByUuid(body.handUuid()).orElse(null);
        if (hand == null) return new ResponseEntity<>(HttpStatus.NOT_FOUND);

        Session session = new Session(hand.getId(), body.userId());
        session.setHandUuid(hand.getUuid());
        session.setDrawMode(hand.getDrawMode());

        boolean isRanked = true;
        if (body.isDaily() && body.dailyDate() != null) {
            LocalDate date = LocalDate.parse(body.dailyDate());
            session.setIsDaily(true);
            session.setDailyDate(date);

            // Same ranked-slot logic for all daily challenges — today's or historical.
            // One ranked win per (user, date, drawMode); subsequent replays are unranked practice.
            boolean hasRanked = sessionRepository
                .existsByUserIdAndDailyDateAndDrawModeAndIsRankedTrueAndStatusIn(
                    body.userId(), date, hand.getDrawMode(),
                    new String[]{ Session.STATUS_WON });
            log.info("createSession: daily branch — date={} drawMode={} hasRanked={}",
                date, hand.getDrawMode(), hasRanked);
            if (hasRanked) {
                isRanked = false;
                session.setIsRanked(false);
            }
        }

        sessionRepository.save(session);
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
