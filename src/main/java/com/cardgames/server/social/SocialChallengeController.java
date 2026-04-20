package com.cardgames.server.social;

import com.cardgames.server.customleague.CustomLeagueMemberRepository;
import com.cardgames.server.friends.Friend;
import com.cardgames.server.friends.FriendRepository;
import com.cardgames.server.session.Session;
import com.cardgames.server.session.SessionRepository;
import com.cardgames.server.user.User;
import com.cardgames.server.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/social")
public class SocialChallengeController {

    private final SocialChallengeRepository            challengeRepo;
    private final SocialChallengeParticipantRepository participantRepo;
    private final SessionRepository                    sessionRepo;
    private final UserRepository                       userRepo;
    private final FriendRepository                     friendRepo;
    private final CustomLeagueMemberRepository         leagueMemberRepo;

    public SocialChallengeController(
            SocialChallengeRepository challengeRepo,
            SocialChallengeParticipantRepository participantRepo,
            SessionRepository sessionRepo,
            UserRepository userRepo,
            FriendRepository friendRepo,
            CustomLeagueMemberRepository leagueMemberRepo) {
        this.challengeRepo    = challengeRepo;
        this.participantRepo  = participantRepo;
        this.sessionRepo      = sessionRepo;
        this.userRepo         = userRepo;
        this.friendRepo       = friendRepo;
        this.leagueMemberRepo = leagueMemberRepo;
    }

    /**
     * POST /api/v1/social/challenges
     * Create a group challenge from a won session.
     *
     * If invitedUserIds is provided (even empty), only those users are invited.
     * If invitedLeagueIds is also provided, all members of those leagues are merged in.
     * If both are null, falls back to inviting all current friends (backward compat).
     */
    @Transactional
    @PostMapping("/challenges")
    public ResponseEntity<SocialChallengeListEntry> createChallenge(
            @RequestBody CreateSocialChallengeRequest req,
            Authentication auth) {

        int userId = (Integer) auth.getPrincipal();

        Session session = sessionRepo.findById(req.sessionId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));

        if (session.getUserId() != userId)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Session does not belong to you");
        if (!Session.STATUS_WON.equals(session.getStatus()))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Session must be a won session");

        SocialChallenge challenge = new SocialChallenge(
            userId, session.getHandId(), session.getId(), session.getDrawMode());
        challenge = challengeRepo.save(challenge);

        // Build the set of participant user IDs
        Set<Integer> inviteeIds = new LinkedHashSet<>();

        if (req.invitedUserIds() == null && req.invitedLeagueIds() == null) {
            // Legacy / from game-win screen: invite all friends
            friendRepo.findAllByUserId(userId)
                .forEach(f -> inviteeIds.add(f.otherUserId(userId)));
        } else {
            // Explicit selection from profile calendar
            if (req.invitedUserIds() != null) {
                inviteeIds.addAll(req.invitedUserIds());
            }
            if (req.invitedLeagueIds() != null) {
                for (int leagueId : req.invitedLeagueIds()) {
                    leagueMemberRepo.findByLeagueId(leagueId).stream()
                        .map(m -> m.getUserId())
                        .forEach(inviteeIds::add);
                }
            }
        }

        // Never invite the creator as a participant
        inviteeIds.remove(userId);

        int finalId = challenge.getId();
        inviteeIds.forEach(id ->
            participantRepo.save(new SocialChallengeParticipant(finalId, id)));

        User creator = userRepo.findById(userId).orElse(null);
        String creatorName = creator != null ? creator.getDisplayName() : "Unknown";

        return ResponseEntity.status(HttpStatus.CREATED).body(new SocialChallengeListEntry(
            challenge.getId(), userId, creatorName,
            challenge.getHandId(), challenge.getDrawMode(),
            SocialChallenge.STATUS_ACTIVE,
            challenge.getCreatedAt(), null,
            inviteeIds.size(), 0, true, true
        ));
    }

    /**
     * GET /api/v1/social/challenges/pending-count
     * Number of active challenges where the user is a participant but hasn't won yet.
     * Used to drive the notification badge on the nav Social tab.
     */
    @GetMapping("/challenges/pending-count")
    public ResponseEntity<Map<String, Integer>> getPendingCount(Authentication auth) {
        int userId = (Integer) auth.getPrincipal();

        List<SocialChallenge> participating =
            challengeRepo.findChallengesWhereParticipant(userId);

        long count = participating.stream()
            .filter(c -> SocialChallenge.STATUS_ACTIVE.equals(c.getStatus()))
            .filter(c -> {
                // Has the user won on this hand already?
                List<Session> won = sessionRepo.findWonSessionsByHandId(c.getHandId());
                return won.stream().noneMatch(s -> s.getUserId() == userId);
            })
            .count();

        return ResponseEntity.ok(Map.of("count", (int) count));
    }

    /**
     * GET /api/v1/social/challenges
     * All challenges the authenticated user is involved in (created or invited).
     * Sorted newest first.
     */
    @GetMapping("/challenges")
    public ResponseEntity<List<SocialChallengeListEntry>> getChallenges(Authentication auth) {
        int userId = (Integer) auth.getPrincipal();

        // Merge created + participating, deduplicate by id, sort newest first
        Map<Integer, SocialChallenge> allMap = new LinkedHashMap<>();
        challengeRepo.findByCreatorUserId(userId)
            .forEach(c -> allMap.put(c.getId(), c));
        challengeRepo.findChallengesWhereParticipant(userId)
            .forEach(c -> allMap.putIfAbsent(c.getId(), c));

        List<SocialChallenge> sorted = allMap.values().stream()
            .sorted(Comparator.comparing(SocialChallenge::getCreatedAt).reversed())
            .collect(Collectors.toList());

        List<SocialChallengeListEntry> result = new ArrayList<>();
        for (SocialChallenge c : sorted) {
            User creator = userRepo.findById(c.getCreatorUserId()).orElse(null);
            String creatorName = creator != null ? creator.getDisplayName() : "Unknown";

            List<SocialChallengeParticipant> participants = participantRepo.findByChallengeId(c.getId());
            boolean isCreator = c.getCreatorUserId() == userId;

            // Count how many participants (+ creator) have a won session on this hand
            List<Session> wonSessions = sessionRepo.findWonSessionsByHandId(c.getHandId());
            Set<Integer> winners = wonSessions.stream()
                .map(Session::getUserId).collect(Collectors.toSet());

            // All people involved: creator + participants
            Set<Integer> involved = new HashSet<>();
            involved.add(c.getCreatorUserId());
            participants.forEach(p -> involved.add(p.getUserId()));

            int winnerCount = (int) involved.stream().filter(winners::contains).count();
            boolean userHasWon = winners.contains(userId);

            result.add(new SocialChallengeListEntry(
                c.getId(), c.getCreatorUserId(), creatorName,
                c.getHandId(), c.getDrawMode(),
                c.getStatus(), c.getCreatedAt(), c.getEndedAt(),
                participants.size(), winnerCount,
                userHasWon, isCreator
            ));
        }
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/v1/social/challenges/{id}
     * Full detail for a challenge including the leaderboard.
     * Each participant's best won session on the hand is used for ranking.
     */
    @GetMapping("/challenges/{id}")
    public ResponseEntity<SocialChallengeDetail> getChallengeDetail(
            @PathVariable int id,
            Authentication auth) {

        int userId = (Integer) auth.getPrincipal();
        SocialChallenge challenge = challengeRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Challenge not found"));

        boolean isCreator = challenge.getCreatorUserId() == userId;
        List<SocialChallengeParticipant> participants = participantRepo.findByChallengeId(id);
        boolean isParticipant = participants.stream().anyMatch(p -> p.getUserId() == userId);
        if (!isCreator && !isParticipant)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not involved in this challenge");

        User creatorUser = userRepo.findById(challenge.getCreatorUserId()).orElse(null);
        String creatorName = creatorUser != null ? creatorUser.getDisplayName() : "Unknown";

        // Build best-session-per-user map for this hand
        List<Session> wonSessions = sessionRepo.findWonSessionsByHandId(challenge.getHandId());
        Map<Integer, Session> bestByUser = new HashMap<>();
        for (Session s : wonSessions) {
            bestByUser.merge(s.getUserId(), s, (existing, neu) ->
                (neu.getMoves() < existing.getMoves() ||
                    (neu.getMoves() == existing.getMoves()
                     && neu.getTimeSeconds() < existing.getTimeSeconds()))
                    ? neu : existing);
        }

        // All involved users: creator + participants
        List<Integer> allUserIds = new ArrayList<>();
        allUserIds.add(challenge.getCreatorUserId());
        participants.stream().map(SocialChallengeParticipant::getUserId).forEach(allUserIds::add);

        // Build leaderboard entries
        List<SocialLeaderboardEntry> entries = new ArrayList<>();
        for (int uid : allUserIds) {
            User u = userRepo.findById(uid).orElse(null);
            String name = u != null ? u.getDisplayName() : "Unknown";
            Session best = bestByUser.get(uid);
            entries.add(new SocialLeaderboardEntry(
                0, uid, name, uid == challenge.getCreatorUserId(),
                best != null ? best.getMoves() : null,
                best != null ? best.getTimeSeconds() : null
            ));
        }

        // Sort: winners first (moves ASC, time ASC), non-winners at bottom
        entries.sort(Comparator
            .<SocialLeaderboardEntry>comparingInt(e -> e.moves() == null ? 1 : 0)
            .thenComparingInt(e -> e.moves() != null ? e.moves() : Integer.MAX_VALUE)
            .thenComparingInt(e -> e.timeSeconds() != null ? e.timeSeconds() : Integer.MAX_VALUE)
        );

        // Assign ranks (1-based, only for winners)
        List<SocialLeaderboardEntry> ranked = new ArrayList<>();
        int rank = 1;
        for (SocialLeaderboardEntry e : entries) {
            ranked.add(new SocialLeaderboardEntry(
                e.moves() != null ? rank++ : 0,
                e.userId(), e.displayName(), e.isCreator(),
                e.moves(), e.timeSeconds()
            ));
        }

        return ResponseEntity.ok(new SocialChallengeDetail(
            challenge.getId(), challenge.getCreatorUserId(), creatorName,
            challenge.getHandId(), challenge.getDrawMode(),
            challenge.getStatus(), challenge.getCreatedAt(), challenge.getEndedAt(),
            ranked
        ));
    }

    /**
     * POST /api/v1/social/challenges/{id}/end
     * Creator ends the challenge (status → "ended").
     */
    @Transactional
    @PostMapping("/challenges/{id}/end")
    public ResponseEntity<Void> endChallenge(@PathVariable int id, Authentication auth) {
        int userId = (Integer) auth.getPrincipal();
        SocialChallenge challenge = challengeRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Challenge not found"));
        if (challenge.getCreatorUserId() != userId)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the creator can end this challenge");
        if (!SocialChallenge.STATUS_ACTIVE.equals(challenge.getStatus()))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Challenge is not active");

        challenge.setStatus(SocialChallenge.STATUS_ENDED);
        challenge.setEndedAt(LocalDateTime.now());
        challengeRepo.save(challenge);
        return ResponseEntity.noContent().build();
    }

    /**
     * POST /api/v1/social/challenges/{id}/resume
     * Creator re-opens an ended challenge (status → "active").
     */
    @Transactional
    @PostMapping("/challenges/{id}/resume")
    public ResponseEntity<Void> resumeChallenge(@PathVariable int id, Authentication auth) {
        int userId = (Integer) auth.getPrincipal();
        SocialChallenge challenge = challengeRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Challenge not found"));
        if (challenge.getCreatorUserId() != userId)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the creator can resume this challenge");
        if (!SocialChallenge.STATUS_ENDED.equals(challenge.getStatus()))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Challenge is not ended");

        challenge.setStatus(SocialChallenge.STATUS_ACTIVE);
        challenge.setEndedAt(null);
        challengeRepo.save(challenge);
        return ResponseEntity.noContent().build();
    }
}
