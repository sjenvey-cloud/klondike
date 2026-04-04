package com.cardgames.server.hand;

import jakarta.persistence.*;
import java.time.LocalDateTime;

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
        this.shuffleSeed = shuffleSeed;
        this.drawMode    = (drawMode != null) ? drawMode : "draw3";
        this.createdAt   = LocalDateTime.now();
    }

    public int           getId()          { return id; }
    public long          getShuffleSeed() { return shuffleSeed; }
    public String        getDrawMode()    { return drawMode; }
    public LocalDateTime getCreatedAt()   { return createdAt; }

    public void setShuffleSeed(long s)    { this.shuffleSeed = s; }
    public void setDrawMode(String m)     { this.drawMode = m; }
    public void setCreatedAt(LocalDateTime t) { this.createdAt = t; }
}
