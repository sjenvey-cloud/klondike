package com.cardgames.server.friends;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "friend_requests")
public class FriendRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(name = "requester_id", nullable = false)
    private int requesterId;

    @Column(name = "requestee_id", nullable = false)
    private int requesteeId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public FriendRequest() {}

    public FriendRequest(int requesterId, int requesteeId) {
        this.requesterId = requesterId;
        this.requesteeId = requesteeId;
        this.createdAt   = LocalDateTime.now();
    }

    public int           getId()          { return id; }
    public int           getRequesterId() { return requesterId; }
    public int           getRequesteeId() { return requesteeId; }
    public LocalDateTime getCreatedAt()   { return createdAt; }
}
