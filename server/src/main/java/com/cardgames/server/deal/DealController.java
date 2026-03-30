package com.cardgames.server.deal;

import java.util.ArrayList;
import java.util.Date;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.cardgames.server.deck.Deck;
import com.cardgames.server.deck.DeckRepository;
import com.cardgames.server.game.GameState;
import com.cardgames.server.game.ReplayResult;


@CrossOrigin(origins = {
    "http://localhost:3000",
    "http://localhost:4200",
    "http://localhost:5173",
    "http://13.60.243.134",
    "https://dbk2b6k1kyjsy.cloudfront.net"
})

@RestController
public class DealController {

    @Autowired
    DealRepository dealRepository;

    @Autowired
    DeckRepository deckRepository;

    @GetMapping("/deal/{id}")
    public ResponseEntity<Deal> show(@PathVariable String id) {
        int dealId = Integer.parseInt(id);
        Deal deal = null;
        try {
            deal = dealRepository.findById(dealId);
        } catch (Exception e) { /* swallow */ }
        return new ResponseEntity<>(deal, HttpStatus.OK);
    }

    @PostMapping("/deal")
    public ResponseEntity<Deal> create(@RequestBody Map<String, String> body) {
        int    moves       = Integer.parseInt(body.get("moves"));
        int    timeseconds = Integer.parseInt(body.get("timeseconds"));
        String turns       = body.get("turns");
        int    deckid      = Integer.parseInt(body.get("deckid"));
        int    userid      = Integer.parseInt(body.get("userid"));

        Deal deal = new Deal(new Date(), moves, timeseconds, turns, deckid, userid);
        try {
            dealRepository.save(deal);
        } catch (Exception e) { /* swallow */ }
        return new ResponseEntity<>(deal, HttpStatus.OK);
    }

    // ── DEV-59: Server-side move history replay validation ────────────────
    /**
     * POST /deal/validate
     * Body: { "deckid": 42, "turns": "draw,wt:2,tt:3:0,...", "claimedWon": true }
     *
     * Fetches the deck from DB, replays every move in the turns string using
     * the server-side Klondike engine, and returns whether the replay is
     * consistent with the claimed outcome.
     *
     * Response: { "valid": true|false, "message": "...", "moveCount": n }
     */
    @PostMapping("/deal/validate")
    public ResponseEntity<ReplayResult> validate(@RequestBody Map<String, String> body) {
        int     deckId      = Integer.parseInt(body.get("deckid"));
        String  turns       = body.getOrDefault("turns", "");
        boolean claimedWon  = Boolean.parseBoolean(body.getOrDefault("claimedWon", "false"));

        Deck deck = null;
        try {
            deck = deckRepository.findById(deckId);
        } catch (Exception e) { /* swallow */ }

        if (deck == null) {
            return new ResponseEntity<>(
                new ReplayResult(false, "Deck not found: " + deckId, 0),
                HttpStatus.NOT_FOUND
            );
        }

        // Build card ID array from deck (card1..card52)
        int[] cardIds = {
            deck.getCard1(),  deck.getCard2(),  deck.getCard3(),  deck.getCard4(),
            deck.getCard5(),  deck.getCard6(),  deck.getCard7(),  deck.getCard8(),
            deck.getCard9(),  deck.getCard10(), deck.getCard11(), deck.getCard12(),
            deck.getCard13(), deck.getCard14(), deck.getCard15(), deck.getCard16(),
            deck.getCard17(), deck.getCard18(), deck.getCard19(), deck.getCard20(),
            deck.getCard21(), deck.getCard22(), deck.getCard23(), deck.getCard24(),
            deck.getCard25(), deck.getCard26(), deck.getCard27(), deck.getCard28(),
            deck.getCard29(), deck.getCard30(), deck.getCard31(), deck.getCard32(),
            deck.getCard33(), deck.getCard34(), deck.getCard35(), deck.getCard36(),
            deck.getCard37(), deck.getCard38(), deck.getCard39(), deck.getCard40(),
            deck.getCard41(), deck.getCard42(), deck.getCard43(), deck.getCard44(),
            deck.getCard45(), deck.getCard46(), deck.getCard47(), deck.getCard48(),
            deck.getCard49(), deck.getCard50(), deck.getCard51(), deck.getCard52()
        };

        GameState   state  = new GameState(cardIds);
        ReplayResult result = state.replay(turns);

        // If player claims a win, verify the server state agrees
        if (result.isValid() && claimedWon && !state.isWon()) {
            result = new ReplayResult(false,
                "Claimed win but replay did not reach a won state", result.getMoveCount());
        }

        HttpStatus status = result.isValid() ? HttpStatus.OK : HttpStatus.UNPROCESSABLE_ENTITY;
        return new ResponseEntity<>(result, status);
    }

    // ── Highscores ────────────────────────────────────────────────────────

    @PostMapping("/deal/highscores/deck/moves")
    public ArrayList<Deal> highscoresDeck(@RequestBody Map<String, String> body) {
        int deckId = Integer.parseInt(body.get("deckid"));
        int limit  = Integer.parseInt(body.get("limit"));
        try {
            return dealRepository.findTopMovesForADeck(deckId, limit);
        } catch (Exception e) { return new ArrayList<>(); }
    }

    @PostMapping("/deal/highscores/deck/times")
    public ArrayList<Deal> topTimesDeck(@RequestBody Map<String, String> body) {
        int deckId = Integer.parseInt(body.get("deckid"));
        int limit  = Integer.parseInt(body.get("limit"));
        try {
            return dealRepository.findTopTimesForADeck(deckId, limit);
        } catch (Exception e) { return new ArrayList<>(); }
    }

    @PostMapping("/deal/highscores/user/moves")
    public ArrayList<Deal> highscoresUser(@RequestBody Map<String, String> body) {
        int userId = Integer.parseInt(body.get("userid"));
        int limit  = Integer.parseInt(body.get("limit"));
        try {
            return dealRepository.findTopMovesForAUser(userId, limit);
        } catch (Exception e) { return new ArrayList<>(); }
    }

    @PostMapping("/deal/highscores/user/times")
    public ArrayList<Deal> topTimesUser(@RequestBody Map<String, String> body) {
        int userid = Integer.parseInt(body.get("userid"));
        int limit  = Integer.parseInt(body.get("limit"));
        try {
            return dealRepository.findTopTimesForAUser(userid, limit);
        } catch (Exception e) { return new ArrayList<>(); }
    }
}
