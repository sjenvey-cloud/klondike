package com.cardgames.server.customleague;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "custom_leagues")
public class CustomLeague {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(nullable = false)
    private String name;

    @Column(name = "creator_user_id", nullable = false)
    private int creatorUserId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public CustomLeague() {}

    public CustomLeague(String name, int creatorUserId) {
        this.name          = name;
        this.creatorUserId = creatorUserId;
        this.createdAt     = LocalDateTime.now();
    }

    public int           getId()            { return id; }
    public String        getName()          { return name; }
    public int           getCreatorUserId() { return creatorUserId; }
    public LocalDateTime getCreatedAt()     { return createdAt; }
}
