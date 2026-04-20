package com.cardgames.server.social;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "social_challenge_participants")
public class SocialChallengeParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(name = "challenge_id", nullable = false)
    private int challengeId;

    @Column(name = "user_id", nullable = false)
    private int userId;

    @Column(name = "added_at", nullable = false)
    private LocalDateTime addedAt;

    public SocialChallengeParticipant() {}

    public SocialChallengeParticipant(int challengeId, int userId) {
        this.challengeId = challengeId;
        this.userId      = userId;
        this.addedAt     = LocalDateTime.now();
    }

    public int           getId()          { return id; }
    public int           getChallengeId() { return challengeId; }
    public int           getUserId()      { return userId; }
    public LocalDateTime getAddedAt()     { return addedAt; }
}
