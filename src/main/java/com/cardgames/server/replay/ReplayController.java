package com.cardgames.server.replay;

import com.cardgames.server.game.SeededShuffle;
import com.cardgames.server.hand.Hand;
import com.cardgames.server.hand.HandRepository;
import com.cardgames.server.session.Session;
import com.cardgames.server.session.SessionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * DEV-219: Replay endpoint.
 *
 * GET /api/v1/sessions/{uuid}/replay
 *
 * Returns the original deal (card order) plus a structured move list parsed
 * from the session's stored turns string. Only won sessions have a complete
 * turns record; any other status returns 422.
 */
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
public class ReplayController {

    private final SessionRepository sessionRepo;
    private final HandRepository    handRepo;

    public ReplayController(SessionRepository sessionRepo, HandRepository handRepo) {
        this.sessionRepo = sessionRepo;
        this.handRepo    = handRepo;
    }

    @GetMapping("/sessions/{uuid}/replay")
    public ResponseEntity<ReplayResponse> getSessionReplay(@PathVariable UUID uuid) {

        Session session = sessionRepo.findByUuid(uuid).orElse(null);
        if (session == null) return ResponseEntity.notFound().build();

        // Only replay completed (won) sessions — they have a validated turns string
        if (!Session.STATUS_WON.equals(session.getStatus())) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).build();
        }

        Hand hand = handRepo.findById(session.getHandId()).orElse(null);
        if (hand == null) return ResponseEntity.notFound().build();

        List<ReplayMove> moves = parseTurns(session.getTurns());
        int[] cards = SeededShuffle.shuffle(hand.getShuffleSeed());

        return ResponseEntity.ok(new ReplayResponse(
            session.getUuid(),
            hand.getUuid(),
            session.getDrawMode(),
            moves.size(),
            moves,
            cards
        ));
    }

    // ── Turn string parser ────────────────────────────────────────────────

    private List<ReplayMove> parseTurns(String turns) {
        if (turns == null || turns.isBlank()) return List.of();
        List<ReplayMove> result = new ArrayList<>();
        for (String raw : turns.split(",")) {
            String token = raw.trim();
            if (token.isEmpty()) continue;
            if ("abandon".equals(token)) break; // stop — subsequent tokens invalid
            ReplayMove move = parseToken(token);
            if (move != null) result.add(move);
        }
        return result;
    }

    private ReplayMove parseToken(String token) {
        String[] p = token.split(":");
        return switch (p[0]) {

            case "draw" -> new ReplayMove("draw", null, null, null, null, null);

            case "wt"   -> p.length >= 2
                ? new ReplayMove("wt", Integer.parseInt(p[1]), null, null, null, null)
                : null;

            case "wf"   -> new ReplayMove("wf", null, null, null, null, null);

            // Current format: tt:fromCol:fromIdx:toCol (explicit stack start)
            // Legacy format:  tt:fromCol:toCol        (server infers first face-up)
            case "tt"   -> {
                if (p.length == 4)
                    yield new ReplayMove("tt", null,
                        Integer.parseInt(p[1]),
                        Integer.parseInt(p[2]),
                        Integer.parseInt(p[3]),
                        null);
                else if (p.length == 3)
                    yield new ReplayMove("tt", null,
                        Integer.parseInt(p[1]),
                        null,                    // fromIdx unknown — frontend must infer
                        Integer.parseInt(p[2]),
                        null);
                else yield null;
            }

            case "tf"   -> p.length >= 2
                ? new ReplayMove("tf", Integer.parseInt(p[1]), null, null, null, null)
                : null;

            // ft:fi:toCol
            case "ft"   -> p.length >= 3
                ? new ReplayMove("ft", null, null, null,
                    Integer.parseInt(p[2]),
                    Integer.parseInt(p[1]))
                : null;

            default -> null; // unknown token — skip gracefully
        };
    }
}
