package com.cardgames.server.daily;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Records which hand has been selected as the daily challenge for a given
 * (date, draw_mode) pair. Populated lazily on first request each day.
 */
@Entity
@Table(name = "daily_challenges")
public class DailyChallenge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(name = "challenge_date", nullable = false)
    private LocalDate challengeDate;

    @Column(name = "draw_mode", nullable = false)
    private String drawMode;

    @Column(name = "hand_id", nullable = false)
    private int handId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public DailyChallenge() {}

    public DailyChallenge(LocalDate challengeDate, String drawMode, int handId) {
        this.challengeDate = challengeDate;
        this.drawMode      = drawMode;
        this.handId        = handId;
    }

    public int       getId()            { return id; }
    public LocalDate getChallengeDate() { return challengeDate; }
    public String    getDrawMode()      { return drawMode; }
    public int       getHandId()        { return handId; }
}
