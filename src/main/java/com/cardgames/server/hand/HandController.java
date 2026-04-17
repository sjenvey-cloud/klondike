package com.cardgames.server.hand;

import com.cardgames.server.daily.LeaderboardEntry;
import com.cardgames.server.game.SeededShuffle;
import com.cardgames.server.session.Session;
import com.cardgames.server.session.SessionRepository;
import com.cardgames.server.user.User;
import com.cardgames.server.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

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
public class HandController {

    @Autowired HandRepository    handRepository;
    @Autowired SessionRepository sessionRepository;
    @Autowired UserRepository    userRepository;

    /**
     * POST /api/v1/hands
     * Body (optional): { "drawMode": "draw1" | "draw3" }
     *
     * Creates a new randomly-dealt hand and returns it with its card order.
     */
    @PostMapping("/hands")
    public ResponseEntity<HandResponse> createHand(
            @RequestBody(required = false) CreateHandRequest body) {

        String drawMode = (body != null && body.drawMode() != null) ? body.drawMode() : "draw3";

        Hand hand = null;
        int attempts = 0;
        while (attempts < 5) {
            long seed = ThreadLocalRandom.current().nextLong(1L, 0x100000000L);
            try {
                hand = handRepository.save(new Hand(seed, drawMode));
                break;
            } catch (DataIntegrityViolationException e) {
                attempts++;
            }
        }

        if (hand == null) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        int[] cards = SeededShuffle.shuffle(hand.getShuffleSeed());
        return new ResponseEntity<>(
            new HandResponse(hand.getId(), hand.getShuffleSeed(), cards, hand.getDrawMode()),
            HttpStatus.CREATED
        );
    }

    /**
     * GET /api/v1/hands/{id}
     *
     * Returns the card order for an existing hand so the client can replay it.
     */
    @GetMapping("/hands/{id}")
    public ResponseEntity<HandResponse> getHand(@PathVariable int id) {
        return handRepository.findById(id)
            .map(h -> {
                int[] cards = SeededShuffle.shuffle(h.getShuffleSeed());
                return ResponseEntity.ok(
                    new HandResponse(h.getId(), h.getShuffleSeed(), cards, h.getDrawMode()));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/v1/hands/{id}/leaderboard
     *
     * All-time leaderboard for a specific deal — any won session counts,
     * deduplicated to one entry per user (their personal best).
     * Sorted by moves ASC, time ASC.
     */
    @GetMapping("/hands/{id}/leaderboard")
    public ResponseEntity<List<LeaderboardEntry>> getHandLeaderboard(@PathVariable int id) {
        List<Session> sessions = sessionRepository.findWonSessionsByHandId(id);

        // Keep best session per user (list already ordered best-first)
        Map<Integer, Session> bestByUser = new LinkedHashMap<>();
        for (Session s : sessions) {
            bestByUser.putIfAbsent(s.getUserId(), s);
        }

        List<LeaderboardEntry> board = new ArrayList<>();
        int rank = 1;
        for (Session s : bestByUser.values()) {
            User user = userRepository.findById(s.getUserId()).orElse(null);
            String name = (user != null) ? user.getDisplayName() : "Unknown";
            board.add(new LeaderboardEntry(rank++, s.getUserId(), name, s.getMoves(), s.getTimeSeconds()));
            if (board.size() == 50) break;
        }
        return ResponseEntity.ok(board);
    }
}
