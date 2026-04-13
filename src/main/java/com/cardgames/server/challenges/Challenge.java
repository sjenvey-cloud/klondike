package com.cardgames.server.challenges;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "challenges")
public class Challenge {

    public static final String STATUS_PENDING   = "pending";
    public static final String STATUS_ACCEPTED  = "accepted";
    public static final String STATUS_COMPLETED = "completed";
    public static final String STATUS_EXPIRED   = "expired";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(name = "challenger_user_id",  nullable = false)
    private int challengerUserId;

    @Column(name = "challenged_user_id",  nullable = false)
    private int challengedUserId;

    @Column(name = "hand_id",             nullable = false)
    private int handId;

    @Column(name = "challenger_session_id", nullable = false)
    private int challengerSessionId;

    @Column(name = "challenged_session_id")
    private Integer challengedSessionId;

    @Column(nullable = false)
    private String status = STATUS_PENDING;

    @Column(name = "created_at",   nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    public Challenge() {}

    public Challenge(int challengerUserId, int challengedUserId, int handId, int challengerSessionId) {
        this.challengerUserId    = challengerUserId;
        this.challengedUserId    = challengedUserId;
        this.handId              = handId;
        this.challengerSessionId = challengerSessionId;
        this.createdAt           = LocalDateTime.now();
    }

    public int           getId()                   { return id; }
    public int           getChallengerUserId()      { return challengerUserId; }
    public int           getChallengedUserId()      { return challengedUserId; }
    public int           getHandId()               { return handId; }
    public int           getChallengerSessionId()  { return challengerSessionId; }
    public Integer       getChallengedSessionId()  { return challengedSessionId; }
    public String        getStatus()               { return status; }
    public LocalDateTime getCreatedAt()            { return createdAt; }
    public LocalDateTime getCompletedAt()          { return completedAt; }

    public void setStatus(String s)                      { this.status = s; }
    public void setChallengedSessionId(Integer sid)      { this.challengedSessionId = sid; }
    public void setCompletedAt(LocalDateTime t)          { this.completedAt = t; }
}
