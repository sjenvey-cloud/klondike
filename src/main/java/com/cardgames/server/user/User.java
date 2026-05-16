package com.cardgames.server.user;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import org.hibernate.annotations.SQLRestriction;

import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.UUID;

@Entity
@Table(name = "users")
@SQLRestriction("deleted_at IS NULL")
public class User implements Serializable {

    private static final long serialVersionUID = 7663960497705998476L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    /** Public identifier — safe to expose in URLs and API responses. */
    @Column(name = "uuid", columnDefinition = "uuid", updatable = false, nullable = false)
    private UUID uuid;

    private String username;

    @Column(name = "email")
    private String email;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "display_name")
    private String displayName;

    @Temporal(TemporalType.TIMESTAMP)
    private Date datecreated;

    @Temporal(TemporalType.TIMESTAMP)
    private Date lasthand;

    /** No-arg constructor — used by JPA for loading existing rows. */
    public User() {
        this.id          = 0;
        this.username    = "none";
        this.datecreated = User.getDefaultTime();
        this.lasthand    = User.getDefaultTime();
    }

    /** Legacy constructor — retained for backward compatibility. */
    public User(String username, Date datecreated, Date lasthand) {
        this.uuid        = UUID.randomUUID();
        this.username    = username;
        this.datecreated = datecreated;
        this.lasthand    = lasthand;
    }

    /** Auth constructor — creates a user via email/password registration. */
    public User(String email, String passwordHash, String displayName) {
        this.uuid         = UUID.randomUUID();
        this.email        = email;
        this.passwordHash = passwordHash;
        this.displayName  = displayName;
        this.username     = displayName; // mirror displayName as username
        this.datecreated  = new Date();
        this.lasthand     = User.getDefaultTime();
    }

    // ── Public UUID identifier ────────────────────────────────────────────

    public UUID getUuid() { return uuid; }

    // ── Internal integer ID — hidden from JSON (DEV-213) ─────────────────

    @JsonIgnore public int  getId()       { return id; }
    public        void setId(int id)      { this.id = id; }

    public String getUsername()              { return username; }
    public void   setUsername(String u)      { this.username = u; }

    public String getEmail()                 { return email; }
    public void   setEmail(String email)     { this.email = email; }

    @JsonIgnore
    public String getPasswordHash()                    { return passwordHash; }
    public void   setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getDisplayName()                   { return displayName; }
    public void   setDisplayName(String displayName) { this.displayName = displayName; }

    public Date getdatecreated()             { return datecreated; }
    public void setdatecreated(Date d)       { this.datecreated = d; }

    public Date getlasthand()                { return lasthand; }
    public void setlasthand(Date d)          { this.lasthand = d; }

    // DEV-228: optional avatar URL (S3 CDN link)
    @Column(name = "avatar_url")
    private String avatarUrl;

    public String getAvatarUrl()             { return avatarUrl; }
    public void   setAvatarUrl(String url)   { this.avatarUrl = url; }

    // DEV-204: soft-delete timestamp — null means account is active
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @JsonIgnore
    public LocalDateTime getDeletedAt()             { return deletedAt; }
    public void          setDeletedAt(LocalDateTime v) { this.deletedAt = v; }

    static Date getDefaultTime() {
        return new Date(Instant.EPOCH.toEpochMilli());
    }
}
