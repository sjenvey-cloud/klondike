package com.cardgames.server.user;

import jakarta.persistence.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.Date;

@Entity
@Table(name = "users")
public class User implements Serializable {

    private static final long serialVersionUID = 7663960497705998476L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

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

    /** No-arg constructor — used by JPA and legacy code paths. */
    public User() {
        this.id          = 0;
        this.username    = "none";
        this.datecreated = User.getDefaultTime();
        this.lasthand    = User.getDefaultTime();
    }

    /** Legacy constructor — retained for backward compatibility. */
    public User(String username, Date datecreated, Date lasthand) {
        this.username    = username;
        this.datecreated = datecreated;
        this.lasthand    = lasthand;
    }

    /** Auth constructor — creates a user via email/password registration. */
    public User(String email, String passwordHash, String displayName) {
        this.email        = email;
        this.passwordHash = passwordHash;
        this.displayName  = displayName;
        this.username     = displayName; // mirror displayName as username
        this.datecreated  = new Date();
        this.lasthand     = User.getDefaultTime();
    }

    public int    getId()          { return id; }
    public void   setId(int id)    { this.id = id; }

    public String getUsername()              { return username; }
    public void   setUsername(String u)      { this.username = u; }

    public String getEmail()                 { return email; }
    public void   setEmail(String email)     { this.email = email; }

    public String getPasswordHash()                    { return passwordHash; }
    public void   setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getDisplayName()                   { return displayName; }
    public void   setDisplayName(String displayName) { this.displayName = displayName; }

    public Date getdatecreated()             { return datecreated; }
    public void setdatecreated(Date d)       { this.datecreated = d; }

    public Date getlasthand()                { return lasthand; }
    public void setlasthand(Date d)          { this.lasthand = d; }

    static Date getDefaultTime() {
        return new Date(Instant.EPOCH.toEpochMilli());
    }
}
