package com.cardgames.server.hand;

import com.cardgames.server.game.SeededShuffle;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.concurrent.ThreadLocalRandom;

@CrossOrigin(origins = {
    "http://localhost:3000",
    "http://localhost:4200",
    "http://localhost:5173",
    "https://dbk2b6k1kyjsy.cloudfront.net"
})
@RestController
@RequestMapping("/api/v1")
public class HandController {

    @Autowired
    HandRepository handRepository;

    /**
     * POST /api/v1/hands
     * Body (optional): { "drawMode": "draw1" | "draw3" }
     *
     * DEV-110: draw_mode stored on the hand so replay validation uses the
     * correct draw count. Defaults to "draw3".
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
}
