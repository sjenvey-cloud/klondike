package com.cardgames.server.session;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "sessions")
public class Session {

    public static final String STATUS_ACTIVE    = "active";
    public static final String STATUS_WON       = "won";
    public static final String STATUS_ABANDONED = "abandoned";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(name = "hand_id", nullable = false)
    private int handId;

    @Column(name = "user_id", nullable = false)
    private int userId;

    @Column(nullable = false)
    private String status;

    @Column(nullable = false)
    private int moves;

    @Column(name = "time_seconds", nullable = false)
    private int timeSeconds;

    @Column(columnDefinition = "TEXT")
    private String turns;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    public Session() {}

    public Session(int handId, int userId) {
        this.handId    = handId;
        this.userId    = userId;
        this.status    = STATUS_ACTIVE;
        this.moves     = 0;
        this.timeSeconds = 0;
        this.startedAt = LocalDateTime.now();
    }

    public int           getId()          { return id; }
    public int           getHandId()      { return handId; }
    public int           getUserId()      { return userId; }
    public String        getStatus()      { return status; }
    public int           getMoves()       { return moves; }
    public int           getTimeSeconds() { return timeSeconds; }
    public String        getTurns()       { return turns; }
    public LocalDateTime getStartedAt()   { return startedAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }

    public void setStatus(String status)               { this.status = status; }
    public void setMoves(int moves)                    { this.moves = moves; }
    public void setTimeSeconds(int timeSeconds)        { this.timeSeconds = timeSeconds; }
    public void setTurns(String turns)                 { this.turns = turns; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
}
