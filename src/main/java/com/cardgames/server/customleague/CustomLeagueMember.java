package com.cardgames.server.customleague;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "custom_league_members")
public class CustomLeagueMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(name = "league_id", nullable = false)
    private int leagueId;

    @Column(name = "user_id", nullable = false)
    private int userId;

    @Column(name = "added_at", nullable = false)
    private LocalDateTime addedAt;

    public CustomLeagueMember() {}

    public CustomLeagueMember(int leagueId, int userId) {
        this.leagueId = leagueId;
        this.userId   = userId;
        this.addedAt  = LocalDateTime.now();
    }

    public int           getId()       { return id; }
    public int           getLeagueId() { return leagueId; }
    public int           getUserId()   { return userId; }
    public LocalDateTime getAddedAt()  { return addedAt; }
}
