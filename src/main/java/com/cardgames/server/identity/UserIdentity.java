package com.cardgames.server.identity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Maps a user to an authentication provider (e.g. 'local', 'google').
 * For this sprint only 'local' (email + password) is used.
 */
@Entity
@Table(name = "user_identities")
public class UserIdentity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(name = "user_id", nullable = false)
    private int userId;

    @Column(name = "provider", nullable = false)
    private String provider;

    @Column(name = "provider_user_id", nullable = false)
    private String providerUserId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public UserIdentity() {}

    public UserIdentity(int userId, String provider, String providerUserId) {
        this.userId         = userId;
        this.provider       = provider;
        this.providerUserId = providerUserId;
        this.createdAt      = LocalDateTime.now();
    }

    public int           getId()             { return id; }
    public int           getUserId()         { return userId; }
    public String        getProvider()       { return provider; }
    public String        getProviderUserId() { return providerUserId; }
    public LocalDateTime getCreatedAt()      { return createdAt; }
}
