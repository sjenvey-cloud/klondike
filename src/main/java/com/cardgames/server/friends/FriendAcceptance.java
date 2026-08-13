package com.cardgames.server.friends;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * A transient acknowledgment that a friend request the user SENT was accepted, so
 * the requester can see it (Social badge + a brief "now friends" note) until they
 * next open the Social tab. Deleted once seen.
 */
@Entity
@Table(name = "friend_acceptances")
public class FriendAcceptance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(name = "requester_id", nullable = false)
    private int requesterId;   // who to notify (the original requester)

    @Column(name = "acceptor_id", nullable = false)
    private int acceptorId;    // who accepted

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "seen", nullable = false)
    private boolean seen = false;

    public FriendAcceptance() {}

    public FriendAcceptance(int requesterId, int acceptorId) {
        this.requesterId = requesterId;
        this.acceptorId  = acceptorId;
        this.createdAt   = LocalDateTime.now();
    }

    public int           getId()          { return id; }
    public int           getRequesterId() { return requesterId; }
    public int           getAcceptorId()  { return acceptorId; }
    public LocalDateTime getCreatedAt()   { return createdAt; }
    public boolean       isSeen()         { return seen; }
    public void          setSeen(boolean s) { this.seen = s; }
}
