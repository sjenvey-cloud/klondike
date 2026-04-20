package com.cardgames.server.social;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "social_challenges")
public class SocialChallenge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(name = "creator_user_id", nullable = false)
    private int creatorUserId;

    @Column(name = "hand_id", nullable = false)
    private int handId;

    @Column(name = "creator_session_id", nullable = false)
    private int creatorSessionId;

    @Column(name = "draw_mode", nullable = false)
    private String drawMode;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    public static final String STATUS_ACTIVE = "active";
    public static final String STATUS_ENDED  = "ended";

    public SocialChallenge() {}

    public SocialChallenge(int creatorUserId, int handId, int creatorSessionId, String drawMode) {
        this.creatorUserId    = creatorUserId;
        this.handId           = handId;
        this.creatorSessionId = creatorSessionId;
        this.drawMode         = drawMode;
        this.status           = STATUS_ACTIVE;
        this.createdAt        = LocalDateTime.now();
    }

    public int           getId()              { return id; }
    public int           getCreatorUserId()   { return creatorUserId; }
    public int           getHandId()          { return handId; }
    public int           getCreatorSessionId(){ return creatorSessionId; }
    public String        getDrawMode()        { return drawMode; }
    public String        getStatus()          { return status; }
    public LocalDateTime getCreatedAt()       { return createdAt; }
    public LocalDateTime getEndedAt()         { return endedAt; }

    public void setStatus(String status)          { this.status  = status; }
    public void setEndedAt(LocalDateTime endedAt) { this.endedAt = endedAt; }
}
