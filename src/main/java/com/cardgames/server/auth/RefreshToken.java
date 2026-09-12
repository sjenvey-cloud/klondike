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

    // Set only when a token is rotated on the refresh path (NOT on logout). A token
    // rotated within a short grace window is still honoured to absorb lost-rotation
    // responses; a logout-revoked token has no rotated_at and is never honoured.
    @Column(name = "rotated_at")
    private LocalDateTime rotatedAt;

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
    public LocalDateTime getRotatedAt() { return rotatedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void setRevoked(boolean revoked) { this.revoked = revoked; }

    /** Rotate this token on the refresh path — revoke it and stamp when, for the grace window. */
    public void markRotated() {
        this.revoked   = true;
        this.rotatedAt = LocalDateTime.now();
    }

    public boolean isExpired() { return expiresAt.isBefore(LocalDateTime.now()); }
    public boolean isValid()   { return !revoked && !isExpired(); }
}
