package com.cardgames.server.customleague;

import com.cardgames.server.friends.FriendRepository;
import com.cardgames.server.friends.FriendRequestRepository;
import com.cardgames.server.league.LeagueEntry;
import com.cardgames.server.session.SessionRepository;
import com.cardgames.server.user.User;
import com.cardgames.server.user.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Tag(name = "Custom Leagues", description = "Named friend leagues with weekly/monthly/all-time leaderboards")
@RestController
@RequestMapping("/api/v1/custom-leagues")
public class CustomLeagueController {

    private final CustomLeagueRepository       leagueRepo;
    private final CustomLeagueMemberRepository memberRepo;
    private final FriendRepository             friendRepo;
    private final FriendRequestRepository      friendRequestRepo;
    private final SessionRepository            sessionRepo;
    private final UserRepository               userRepo;

    public CustomLeagueController(
            CustomLeagueRepository       leagueRepo,
            CustomLeagueMemberRepository memberRepo,
            FriendRepository             friendRepo,
            FriendRequestRepository      friendRequestRepo,
            SessionRepository            sessionRepo,
            UserRepository               userRepo) {
        this.leagueRepo        = leagueRepo;
        this.memberRepo        = memberRepo;
        this.friendRepo        = friendRepo;
        this.friendRequestRepo = friendRequestRepo;
        this.sessionRepo       = sessionRepo;
        this.userRepo          = userRepo;
    }

    // ── POST /api/v1/custom-leagues ─ create a new league ─────────────────

    @Operation(summary = "Create a named league and add initial members")
    @PostMapping
    public ResponseEntity<CustomLeagueListEntry> createLeague(
            @RequestBody CreateLeagueRequest req, Authentication auth) {

        if (req.name() == null || req.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "League name is required");
        }

        int userId = (Integer) auth.getPrincipal();
        CustomLeague league = leagueRepo.save(new CustomLeague(req.name().trim(), userId));

        // Creator is always a member
        memberRepo.save(new CustomLeagueMember(league.getId(), userId));

        // Add requested friends (deduplicated, skip self)
        if (req.memberIds() != null) {
            req.memberIds().stream()
                .distinct()
                .filter(id -> id != userId)
                .forEach(id -> memberRepo.save(new CustomLeagueMember(league.getId(), id)));
        }

        User creator = userRepo.findById(userId).orElseThrow();
        int  count   = memberRepo.countByLeagueId(league.getId());

        return ResponseEntity.ok(new CustomLeagueListEntry(
            league.getId(), league.getName(), userId,
            creator.getDisplayName(), count, true, league.getCreatedAt()));
    }

    // ── GET /api/v1/custom-leagues ─ leagues I'm in ────────────────────────

    @Operation(summary = "List all leagues the authenticated user belongs to")
    @GetMapping
    public ResponseEntity<List<CustomLeagueListEntry>> listLeagues(Authentication auth) {
        int userId = (Integer) auth.getPrincipal();

        List<CustomLeagueListEntry> result = memberRepo.findByUserId(userId).stream()
            .map(m -> leagueRepo.findById(m.getLeagueId()).orElse(null))
            .filter(Objects::nonNull)
            .map(league -> {
                User creator = userRepo.findById(league.getCreatorUserId()).orElse(null);
                int  count   = memberRepo.countByLeagueId(league.getId());
                return new CustomLeagueListEntry(
                    league.getId(), league.getName(), league.getCreatorUserId(),
                    creator != null ? creator.getDisplayName() : "Unknown",
                    count, league.getCreatorUserId() == userId, league.getCreatedAt());
            })
            .sorted(Comparator.comparing(CustomLeagueListEntry::createdAt).reversed())
            .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ── GET /api/v1/custom-leagues/{id} ─ detail with members ─────────────

    @Operation(summary = "Get league detail with member list and friend status")
    @GetMapping("/{id}")
    public ResponseEntity<CustomLeagueDetail> getLeague(
            @PathVariable int id, Authentication auth) {

        int          userId = (Integer) auth.getPrincipal();
        CustomLeague league = requireLeague(id);
        requireMember(id, userId);

        Set<Integer> friendIds = friendRepo.findAllByUserId(userId).stream()
            .map(f -> f.otherUserId(userId))
            .collect(Collectors.toSet());

        Set<Integer> pendingIds = friendRequestRepo.findByRequesterId(userId).stream()
            .map(r -> r.getRequesteeId())
            .collect(Collectors.toSet());

        List<CustomLeagueMemberEntry> members = memberRepo.findByLeagueId(id).stream()
            .map(m -> {
                User u = userRepo.findById(m.getUserId()).orElse(null);
                if (u == null) return null;
                boolean isFriend  = m.getUserId() == userId || friendIds.contains(m.getUserId());
                boolean hasPending = pendingIds.contains(m.getUserId());
                return new CustomLeagueMemberEntry(m.getUserId(), u.getDisplayName(), isFriend, hasPending);
            })
            .filter(Objects::nonNull)
            .collect(Collectors.toList());

        return ResponseEntity.ok(new CustomLeagueDetail(
            league.getId(), league.getName(), league.getCreatorUserId(),
            league.getCreatedAt(), league.getCreatorUserId() == userId, members));
    }

    // ── GET /api/v1/custom-leagues/{id}/leaderboard?period=week ───────────

    @Operation(summary = "League leaderboard (period: week/daily/monthly/alltime)")
    @GetMapping("/{id}/leaderboard")
    public ResponseEntity<List<LeagueEntry>> getLeaderboard(
            @PathVariable int id,
            @RequestParam(defaultValue = "week") String period,
            Authentication auth) {

        int userId = (Integer) auth.getPrincipal();
        requireLeague(id);
        requireMember(id, userId);

        List<Integer> memberIds = memberRepo.findByLeagueId(id).stream()
            .map(CustomLeagueMember::getUserId)
            .collect(Collectors.toList());

        return ResponseEntity.ok(computeLeaderboard(memberIds, windowStart(period)));
    }

    // ── DELETE /api/v1/custom-leagues/{id} ─ delete (creator only) ─────────

    @Operation(summary = "Delete a league (creator only)")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLeague(
            @PathVariable int id, Authentication auth) {

        int          userId = (Integer) auth.getPrincipal();
        CustomLeague league = requireLeague(id);
        requireCreator(league, userId);

        leagueRepo.delete(league);
        return ResponseEntity.noContent().build();
    }

    // ── POST /api/v1/custom-leagues/{id}/members ─ add members ────────────

    @PostMapping("/{id}/members")
    public ResponseEntity<Void> addMembers(
            @PathVariable int id,
            @RequestBody AddMembersRequest req,
            Authentication auth) {

        int          userId = (Integer) auth.getPrincipal();
        CustomLeague league = requireLeague(id);
        requireCreator(league, userId);

        if (req.userIds() != null) {
            req.userIds().stream()
                .distinct()
                .filter(uid -> !memberRepo.existsByLeagueIdAndUserId(id, uid))
                .forEach(uid -> memberRepo.save(new CustomLeagueMember(id, uid)));
        }

        return ResponseEntity.noContent().build();
    }

    // ── DELETE /api/v1/custom-leagues/{id}/members/{targetUserId} ──────────

    @DeleteMapping("/{id}/members/{targetUserId}")
    public ResponseEntity<Void> removeMember(
            @PathVariable int id,
            @PathVariable int targetUserId,
            Authentication auth) {

        int          userId = (Integer) auth.getPrincipal();
        CustomLeague league = requireLeague(id);
        requireCreator(league, userId);

        if (targetUserId == league.getCreatorUserId()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Cannot remove the creator");
        }

        memberRepo.findByLeagueIdAndUserId(id, targetUserId)
            .ifPresent(memberRepo::delete);

        return ResponseEntity.noContent().build();
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private CustomLeague requireLeague(int id) {
        return leagueRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "League not found"));
    }

    private void requireMember(int leagueId, int userId) {
        if (!memberRepo.existsByLeagueIdAndUserId(leagueId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member of this league");
        }
    }

    private void requireCreator(CustomLeague league, int userId) {
        if (league.getCreatorUserId() != userId) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the creator can do this");
        }
    }

    private List<LeagueEntry> computeLeaderboard(List<Integer> memberIds, LocalDateTime since) {
        List<Object[]> rows = sessionRepo.findLeagueStats(memberIds, since);

        Map<Integer, int[]> statsMap = new HashMap<>();
        for (Object[] row : rows) {
            int uid  = ((Number) row[0]).intValue();
            int wins = ((Number) row[1]).intValue();
            int best = row[2] != null ? ((Number) row[2]).intValue() : Integer.MAX_VALUE;
            statsMap.put(uid, new int[]{ wins, best });
        }

        List<LeagueEntry> entries = new ArrayList<>();
        for (int uid : memberIds) {
            User u = userRepo.findById(uid).orElse(null);
            if (u == null) continue;
            int[]   s    = statsMap.getOrDefault(uid, new int[]{ 0, Integer.MAX_VALUE });
            Integer best = (s[0] > 0) ? s[1] : null;
            entries.add(new LeagueEntry(0, uid, u.getDisplayName(), s[0], best));
        }

        entries.sort(Comparator
            .comparingInt(LeagueEntry::wins).reversed()
            .thenComparingInt(e -> e.bestMoves() != null ? e.bestMoves() : Integer.MAX_VALUE));

        List<LeagueEntry> ranked = new ArrayList<>();
        for (int i = 0; i < entries.size(); i++) {
            LeagueEntry e = entries.get(i);
            ranked.add(new LeagueEntry(i + 1, e.userId(), e.displayName(), e.wins(), e.bestMoves()));
        }
        return ranked;
    }

    private LocalDateTime windowStart(String period) {
        return switch (period) {
            case "daily"   -> LocalDate.now().atStartOfDay();
            case "monthly" -> LocalDate.now().withDayOfMonth(1).atStartOfDay();
            case "alltime" -> LocalDateTime.of(2000, 1, 1, 0, 0);
            default        -> LocalDate.now().minusDays(6).atStartOfDay(); // week
        };
    }
}
