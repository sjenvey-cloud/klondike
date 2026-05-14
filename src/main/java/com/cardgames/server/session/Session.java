package com.cardgames.server.session;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "sessions")
public class Session {

    public static final String STATUS_ACTIVE    = "active";
    public static final String STATUS_WON       = "won";
    public static final String STATUS_ABANDONED = "abandoned";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    /** Public identifier — safe to expose in URLs and API responses. */
    @Column(name = "uuid", columnDefinition = "uuid", updatable = false, nullable = false)
    private UUID uuid;

    @Column(name = "hand_id", nullable = false)
    private int handId;

    /**
     * Denormalised hand UUID — copied from hands.uuid at session-creation time.
     * Allows API responses to return the hand UUID without an extra join.
     */
    @Column(name = "hand_uuid", columnDefinition = "uuid", updatable = false, nullable = false)
    private UUID handUuid;

    @Column(name = "user_id", nullable = false)
    private int userId;

    @Column(nullable = false)
    private String status;

    @Column(nullable = false)
    private int moves;

    @Column(name = "time_seconds", nullable = false)
    private int timeSeconds;

    @Column(columnDefinition = "TEXT")
    private String turns;

    @Column(name = "draw_mode", nullable = false)
    private String drawMode = "draw3";

    @Column(name = "is_daily", nullable = false)
    private boolean isDaily = false;

    @Column(name = "daily_date")
    private LocalDate dailyDate;

    @Column(name = "is_ranked", nullable = false)
    private boolean isRanked = true;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    public Session() {}

    public Session(int handId, int userId) {
        this.uuid      = UUID.randomUUID();
        this.handId    = handId;
        this.userId    = userId;
        this.status    = STATUS_ACTIVE;
        this.moves     = 0;
        this.timeSeconds = 0;
        this.startedAt = LocalDateTime.now();
    }

    // ── Public UUID identifiers ───────────────────────────────────────────

    public UUID getUuid()     { return uuid; }
    public UUID getHandUuid() { return handUuid; }
    public void setHandUuid(UUID u) { this.handUuid = u; }

    // ── Internal integer IDs — hidden from JSON (DEV-213) ─────────────────

    @JsonIgnore public int getId()     { return id; }
    @JsonIgnore public int getHandId() { return handId; }
    @JsonIgnore public int getUserId() { return userId; }

    // ── Game fields ───────────────────────────────────────────────────────

    public String        getStatus()      { return status; }
    public int           getMoves()       { return moves; }
    public int           getTimeSeconds() { return timeSeconds; }
    @JsonIgnore public String getTurns()   { return turns; }
    public String        getDrawMode()    { return drawMode; }
    public boolean       isDaily()        { return isDaily; }
    public LocalDate     getDailyDate()   { return dailyDate; }
    public boolean       isRanked()       { return isRanked; }
    public LocalDateTime getStartedAt()   { return startedAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }

    public void setStatus(String s)             { this.status = s; }
    public void setMoves(int m)                 { this.moves = m; }
    public void setTimeSeconds(int t)           { this.timeSeconds = t; }
    public void setTurns(String t)              { this.turns = t; }
    public void setDrawMode(String m)           { this.drawMode = m; }
    public void setIsDaily(boolean d)           { this.isDaily = d; }
    public void setDailyDate(LocalDate d)       { this.dailyDate = d; }
    public void setIsRanked(boolean r)          { this.isRanked = r; }
    public void setCompletedAt(LocalDateTime t) { this.completedAt = t; }
}
