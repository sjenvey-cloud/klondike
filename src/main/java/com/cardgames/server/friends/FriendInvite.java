package com.cardgames.server.friends;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "friend_invites")
public class FriendInvite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(nullable = false, unique = true)
    private String token;

    @Column(name = "inviter_id", nullable = false)
    private int inviterId;

    @Column(name = "accepted_by")
    private Integer acceptedBy;

    @Column(nullable = false)
    private boolean accepted = false;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public FriendInvite() {}

    public FriendInvite(String token, int inviterId) {
        this.token     = token;
        this.inviterId = inviterId;
        this.createdAt = LocalDateTime.now();
        this.expiresAt = this.createdAt.plusHours(72);
    }

    public int           getId()         { return id; }
    public String        getToken()      { return token; }
    public int           getInviterId()  { return inviterId; }
    public Integer       getAcceptedBy() { return acceptedBy; }
    public boolean       isAccepted()    { return accepted; }
    public LocalDateTime getExpiresAt()  { return expiresAt; }
    public LocalDateTime getCreatedAt()  { return createdAt; }

    public void accept(int userId) {
        this.accepted   = true;
        this.acceptedBy = userId;
    }
}
