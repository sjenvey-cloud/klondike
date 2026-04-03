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
     *
     * Generates a unique shuffle seed, verifies it has not been used before
     * (UNIQUE constraint + retry), shuffles the deck server-side, persists
     * the hand, and returns the seed + card order to the client.
     *
     * The client can reproduce the card order at any time using the seed
     * and the seededShuffle() JS function (DEV-73).
     *
     * Seeds are drawn from [1, 2^32) — zero is excluded as it is a
     * degenerate xorshift32 fixed point.
     */
    @PostMapping("/hands")
    public ResponseEntity<HandResponse> createHand() {
        Hand hand = null;
        int attempts = 0;

        // Retry on the (astronomically unlikely) event of a seed collision.
        while (attempts < 5) {
            long seed = ThreadLocalRandom.current().nextLong(1L, 0x100000000L);
            try {
                hand = handRepository.save(new Hand(seed));
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
            new HandResponse(hand.getId(), hand.getShuffleSeed(), cards),
            HttpStatus.CREATED
        );
    }
}
