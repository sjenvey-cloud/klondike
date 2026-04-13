package com.cardgames.server.friends;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "friends")
public class Friend {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(name = "user_id_a", nullable = false)
    private int userIdA;

    @Column(name = "user_id_b", nullable = false)
    private int userIdB;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public Friend() {}

    public Friend(int userIdA, int userIdB) {
        this.userIdA    = Math.min(userIdA, userIdB);
        this.userIdB    = Math.max(userIdA, userIdB);
        this.createdAt  = LocalDateTime.now();
    }

    public int           getId()        { return id; }
    public int           getUserIdA()   { return userIdA; }
    public int           getUserIdB()   { return userIdB; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public int otherUserId(int selfId) {
        return selfId == userIdA ? userIdB : userIdA;
    }
}
