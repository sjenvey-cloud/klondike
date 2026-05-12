package com.cardgames.server.hand;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A Hand represents a unique shuffled deck configuration identified by its
 * shuffle_seed. The actual card order is reproduced deterministically from
 * the seed using SeededShuffle — it is never stored in the database.
 */
@Entity
@Table(name = "hands")
public class Hand {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    /** Public identifier — safe to expose in URLs and API responses. */
    @Column(name = "uuid", columnDefinition = "uuid", updatable = false, nullable = false)
    private UUID uuid;

    @Column(name = "shuffle_seed", nullable = false, unique = true)
    private long shuffleSeed;

    @Column(name = "draw_mode", nullable = false)
    private String drawMode = "draw3";

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public Hand() {}

    public Hand(long shuffleSeed) {
        this(shuffleSeed, "draw3");
    }

    public Hand(long shuffleSeed, String drawMode) {
        this.uuid        = UUID.randomUUID();
        this.shuffleSeed = shuffleSeed;
        this.drawMode    = (drawMode != null) ? drawMode : "draw3";
        this.createdAt   = LocalDateTime.now();
    }

    // ── Public UUID identifier ────────────────────────────────────────────

    public UUID getUuid() { return uuid; }

    // ── Internal integer ID — hidden from JSON (DEV-213) ─────────────────

    @JsonIgnore public int getId() { return id; }

    public long          getShuffleSeed() { return shuffleSeed; }
    public String        getDrawMode()    { return drawMode; }
    public LocalDateTime getCreatedAt()   { return createdAt; }

    public void setShuffleSeed(long s)        { this.shuffleSeed = s; }
    public void setDrawMode(String m)         { this.drawMode = m; }
    public void setCreatedAt(LocalDateTime t) { this.createdAt = t; }
}
