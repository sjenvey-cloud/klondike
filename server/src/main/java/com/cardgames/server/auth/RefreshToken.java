package com.cardgames.server.auth;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(columnDefinition = "UUID")
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private int userId;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    private boolean revoked = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public RefreshToken() {}

    public RefreshToken(int userId, String tokenHash, LocalDateTime expiresAt) {
        this.userId    = userId;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.revoked   = false;
        this.createdAt = LocalDateTime.now();
    }

    public UUID          getId()        { return id; }
    public int           getUserId()    { return userId; }
    public String        getTokenHash() { return tokenHash; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public boolean       isRevoked()    { return revoked; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void setRevoked(boolean revoked) { this.revoked = revoked; }

    public boolean isExpired() { return expiresAt.isBefore(LocalDateTime.now()); }
    public boolean isValid()   { return !revoked && !isExpired(); }
}
