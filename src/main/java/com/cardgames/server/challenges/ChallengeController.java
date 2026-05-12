package com.cardgames.server.challenges;

import com.cardgames.server.game.SeededShuffle;
import com.cardgames.server.hand.Hand;
import com.cardgames.server.hand.HandRepository;
import com.cardgames.server.session.Session;
import com.cardgames.server.session.SessionRepository;
import com.cardgames.server.user.User;
import com.cardgames.server.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/challenges")
public class ChallengeController {

    private final ChallengeRepository challengeRepository;
    private final SessionRepository   sessionRepository;
    private final HandRepository      handRepository;
    private final UserRepository      userRepository;

    public ChallengeController(ChallengeRepository challengeRepository,
                               SessionRepository sessionRepository,
                               HandRepository handRepository,
                               UserRepository userRepository) {
        this.challengeRepository = challengeRepository;
        this.sessionRepository   = sessionRepository;
        this.handRepository      = handRepository;
        this.userRepository      = userRepository;
    }

    // ── DEV-160: POST /api/v1/challenges ─────────────────────────────────

    @PostMapping
    public ResponseEntity<ChallengeResponse> createChallenge(
            @RequestBody CreateChallengeRequest body, Authentication auth) {

        int userId = (Integer) auth.getPrincipal();

        Session session = sessionRepository.findByUuid(body.sessionUuid())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));

        if (session.getUserId() != userId) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Session does not belong to you");
        }
        if (!Session.STATUS_WON.equals(session.getStatus())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Session is not a won session");
        }

        Challenge challenge = new Challenge(
            userId, body.challengedUserId(), session.getHandId(), session.getId());
        challengeRepository.save(challenge);

        Hand hand = handRepository.findById(challenge.getHandId()).orElse(null);
        UUID handUuid = hand != null ? hand.getUuid() : null;

        return ResponseEntity.status(HttpStatus.CREATED).body(new ChallengeResponse(
            challenge.getId(),
            handUuid,
            challenge.getChallengedUserId(),
            challenge.getStatus(),
            challenge.getCreatedAt()
        ));
    }

    // ── DEV-161: GET /api/v1/challenges/inbox ────────────────────────────

    @GetMapping("/inbox")
    public ResponseEntity<List<InboxEntry>> getInbox(Authentication auth) {
        int userId = (Integer) auth.getPrincipal();
        List<Challenge> pending = challengeRepository
            .findByChallengedUserIdAndStatus(userId, Challenge.STATUS_PENDING);

        List<InboxEntry> entries = pending.stream().map(c -> {
            Session challengerSession = sessionRepository.findById(c.getChallengerSessionId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Session missing"));
            User challenger = userRepository.findById(c.getChallengerUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "User missing"));

            Hand hand = handRepository.findById(c.getHandId()).orElse(null);
            UUID handUuid = hand != null ? hand.getUuid() : null;

            return new InboxEntry(
                c.getId(),
                challenger.getUuid(),
                challenger.getDisplayName(),
                handUuid,
                challengerSession.getMoves(),
                challengerSession.getTimeSeconds(),
                c.getCreatedAt()
            );
        }).collect(Collectors.toList());

        return ResponseEntity.ok(entries);
    }

    // ── DEV-162: POST /api/v1/challenges/{id}/play ───────────────────────

    @PostMapping("/{id}/play")
    public ResponseEntity<PlayResponse> playChallenge(
            @PathVariable int id, Authentication auth) {

        int userId = (Integer) auth.getPrincipal();

        Challenge challenge = challengeRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Challenge not found"));

        if (challenge.getChallengedUserId() != userId) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your challenge");
        }
        if (!Challenge.STATUS_PENDING.equals(challenge.getStatus())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Challenge is not pending");
        }

        Hand hand = handRepository.findById(challenge.getHandId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Hand not found"));

        // Create a new session for the challenged player on the same hand
        Session session = new Session(hand.getId(), userId);
        session.setDrawMode(hand.getDrawMode());
        session.setHandUuid(hand.getUuid());
        sessionRepository.save(session);

        // Link challenged session and mark accepted
        challenge.setChallengedSessionId(session.getId());
        challenge.setStatus(Challenge.STATUS_ACCEPTED);
        challengeRepository.save(challenge);

        int[] cards = SeededShuffle.shuffle(hand.getShuffleSeed());

        return ResponseEntity.ok(new PlayResponse(
            session.getUuid(),
            hand.getUuid(),
            hand.getShuffleSeed(),
            cards,
            hand.getDrawMode()
        ));
    }
}
