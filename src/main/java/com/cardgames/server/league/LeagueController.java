package com.cardgames.server.league;

import com.cardgames.server.friends.Friend;
import com.cardgames.server.friends.FriendRepository;
import com.cardgames.server.session.SessionRepository;
import com.cardgames.server.user.User;
import com.cardgames.server.user.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Tag(name = "League (Friends)", description = "Automatic friends league leaderboard — no setup required")
@RestController
@RequestMapping("/api/v1/leagues")
public class LeagueController {

    private final FriendRepository  friendRepository;
    private final SessionRepository sessionRepository;
    private final UserRepository    userRepository;

    public LeagueController(FriendRepository friendRepository,
                            SessionRepository sessionRepository,
                            UserRepository userRepository) {
        this.friendRepository  = friendRepository;
        this.sessionRepository = sessionRepository;
        this.userRepository    = userRepository;
    }

    /**
     * GET /api/v1/leagues?period=daily|weekly|monthly|alltime
     * DEV-164: ranked wins + best moves for the authenticated user and all their friends.
     */
    @Operation(summary = "Friends league leaderboard", description = "Ranked wins for the caller and all their friends. Period: daily/weekly/monthly/alltime.")
    @GetMapping
    public ResponseEntity<List<LeagueEntry>> getLeague(
            @RequestParam(defaultValue = "weekly") String period,
            Authentication auth) {

        int userId = (Integer) auth.getPrincipal();

        // Build participant list: self + friends
        List<Friend> friendships = friendRepository.findAllByUserId(userId);
        List<Integer> userIds = new ArrayList<>();
        userIds.add(userId);
        friendships.forEach(f -> userIds.add(f.otherUserId(userId)));

        LocalDateTime since = windowStart(period);
        List<Object[]> rows = sessionRepository.findLeagueStats(userIds, since);

        // Map userId → { wins, bestMoves }
        Map<Integer, int[]> statsMap = new HashMap<>();
        for (Object[] row : rows) {
            int uid      = ((Number) row[0]).intValue();
            int wins     = ((Number) row[1]).intValue();
            Integer best = row[2] != null ? ((Number) row[2]).intValue() : null;
            statsMap.put(uid, new int[]{ wins, best != null ? best : Integer.MAX_VALUE });
        }

        // Build entries for all participants (include zero-win entries)
        List<LeagueEntry> entries = new ArrayList<>();
        for (int uid : userIds) {
            User user = userRepository.findById(uid).orElse(null);
            if (user == null) continue;
            int[]   s    = statsMap.getOrDefault(uid, new int[]{ 0, Integer.MAX_VALUE });
            Integer best = (s[0] > 0) ? s[1] : null;
            entries.add(new LeagueEntry(0, uid, user.getDisplayName(), s[0], best));
        }

        // Sort: most wins desc, then best moves asc
        entries.sort(Comparator
            .comparingInt(LeagueEntry::wins).reversed()
            .thenComparingInt(e -> (e.bestMoves() != null ? e.bestMoves() : Integer.MAX_VALUE)));

        // Assign ranks
        List<LeagueEntry> ranked = new ArrayList<>();
        for (int i = 0; i < entries.size(); i++) {
            LeagueEntry e = entries.get(i);
            ranked.add(new LeagueEntry(i + 1, e.userId(), e.displayName(), e.wins(), e.bestMoves()));
        }

        return ResponseEntity.ok(ranked);
    }

    private LocalDateTime windowStart(String period) {
        return switch (period) {
            case "daily"   -> LocalDate.now().atStartOfDay();
            case "monthly" -> LocalDate.now().withDayOfMonth(1).atStartOfDay();
            case "alltime" -> LocalDateTime.of(2000, 1, 1, 0, 0);
            default        -> LocalDate.now().minusDays(6).atStartOfDay(); // weekly
        };
    }
}
