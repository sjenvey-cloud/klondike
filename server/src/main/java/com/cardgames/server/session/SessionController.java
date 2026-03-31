package com.cardgames.server.session;

import com.cardgames.server.game.GameState;
import com.cardgames.server.game.ReplayResult;
import com.cardgames.server.hand.Hand;
import com.cardgames.server.hand.HandRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@CrossOrigin(origins = {
    "http://localhost:3000",
    "http://localhost:4200",
    "http://localhost:5173",
    "https://dbk2b6k1kyjsy.cloudfront.net"
})
@RestController
@RequestMapping("/api/v1")
public class SessionController {

    @Autowired SessionRepository sessionRepository;
    @Autowired HandRepository     handRepository;

    // ── DEV-69: Create session ────────────────────────────────────────────

    /**
     * POST /api/v1/sessions
     * Body: { "handId": 42, "userId": 7 }
     *
     * Creates a new active session for the given hand and user.
     * Called once when the player starts a new game.
     */
    @PostMapping("/sessions")
    public ResponseEntity<Session> createSession(@RequestBody CreateSessionRequest body) {
        Hand hand = handRepository.findById(body.handId()).orElse(null);
        if (hand == null) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
        Session session = sessionRepository.save(new Session(body.handId(), body.userId()));
        return new ResponseEntity<>(session, HttpStatus.CREATED);
    }

    // ── DEV-71: Complete session (win) ────────────────────────────────────

    /**
     * POST /api/v1/sessions/{id}/complete
     * Body: { "moves": 42, "timeSeconds": 180, "turns": "draw,wt:2,..." }
     *
     * Reproduces the hand from its seed, replays every move server-side,
     * and validates that the game was genuinely won. On success the session
     * is persisted as status=won. On failure HTTP 422 is returned and the
     * session record is NOT modified.
     */
    @PostMapping("/sessions/{id}/complete")
    public ResponseEntity<CompleteSessionResponse> completeSession(
            @PathVariable int id,
            @RequestBody EndSessionRequest body) {

        Session session = sessionRepository.findById(id).orElse(null);
        if (session == null) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }

        Hand hand = handRepository.findById(session.getHandId()).orElse(null);
        if (hand == null) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }

        // Reproduce card order from seed and replay moves
        GameState    state  = new GameState(hand.getShuffleSeed());
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

        session.setStatus(Session.STATUS_WON);
        session.setMoves(body.moves());
        session.setTimeSeconds(body.timeSeconds());
        session.setTurns(body.turns());
        session.setCompletedAt(LocalDateTime.now());
        sessionRepository.save(session);

        return new ResponseEntity<>(
            new CompleteSessionResponse(true, "OK", result.getMoveCount(), session),
            HttpStatus.OK
        );
    }

    // ── DEV-72: Abandon session ───────────────────────────────────────────

    /**
     * POST /api/v1/sessions/{id}/abandon
     * Body: { "moves": 12, "timeSeconds": 60, "turns": "draw,wt:2,..." }
     *
     * Marks the session as abandoned and appends the "abandon" token to the
     * turns string. The move history is stored for analytics but not
     * validated — only completed sessions are replay-checked.
     */
    @PostMapping("/sessions/{id}/abandon")
    public ResponseEntity<Session> abandonSession(
            @PathVariable int id,
            @RequestBody EndSessionRequest body) {

        Session session = sessionRepository.findById(id).orElse(null);
        if (session == null) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }

        String turns = (body.turns() != null && !body.turns().isBlank())
            ? body.turns() + ",abandon"
            : "abandon";

        session.setStatus(Session.STATUS_ABANDONED);
        session.setMoves(body.moves());
        session.setTimeSeconds(body.timeSeconds());
        session.setTurns(turns);
        session.setCompletedAt(LocalDateTime.now());
        sessionRepository.save(session);

        return new ResponseEntity<>(session, HttpStatus.OK);
    }
}
