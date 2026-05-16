package com.cardgames.server.preferences;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_preferences")
public class UserPreferences {

    @Id
    @Column(name = "user_id")
    private int userId;

    @Column(name = "draw_mode_default", nullable = false)
    private String drawModeDefault = "draw3";

    @Column(name = "card_face_design", nullable = false)
    private String cardFaceDesign = "standard";

    @Column(name = "card_style", nullable = false)
    private String cardStyle = "classic";

    @Column(name = "card_back_colour", nullable = false)
    private String cardBackColour = "#1c2333";

    @Column(name = "card_back_pattern")
    private String cardBackPattern;

    @Column(name = "felt_colour", nullable = false)
    private String feltColour = "#0d1117";

    @Column(name = "animations_enabled", nullable = false)
    private boolean animationsEnabled = true;

    @Column(name = "stock_side", nullable = false)
    private String stockSide = "left";

    @Column(name = "animation_speed", nullable = false)
    private String animationSpeed = "normal";

    @Column(name = "win_animation", nullable = false)
    private String winAnimation = "confetti";

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public UserPreferences() {}

    public UserPreferences(int userId) {
        this.userId = userId;
        this.updatedAt = LocalDateTime.now();
    }

    public int           getUserId()           { return userId; }
    public String        getDrawModeDefault()  { return drawModeDefault; }
    public String        getCardFaceDesign()   { return cardFaceDesign; }
    public String        getCardStyle()        { return cardStyle; }
    public String        getCardBackColour()   { return cardBackColour; }
    public String        getCardBackPattern()  { return cardBackPattern; }
    public String        getFeltColour()       { return feltColour; }
    public boolean       isAnimationsEnabled() { return animationsEnabled; }
    public String        getStockSide()        { return stockSide; }
    public String        getAnimationSpeed()   { return animationSpeed; }
    public String        getWinAnimation()     { return winAnimation; }
    public LocalDateTime getUpdatedAt()        { return updatedAt; }

    public void setDrawModeDefault(String v)  { this.drawModeDefault = v; this.updatedAt = LocalDateTime.now(); }
    public void setCardFaceDesign(String v)   { this.cardFaceDesign = v;  this.updatedAt = LocalDateTime.now(); }
    public void setCardStyle(String v)        { this.cardStyle = v;       this.updatedAt = LocalDateTime.now(); }
    public void setCardBackColour(String v)   { this.cardBackColour = v;  this.updatedAt = LocalDateTime.now(); }
    public void setCardBackPattern(String v)  { this.cardBackPattern = v; this.updatedAt = LocalDateTime.now(); }
    public void setFeltColour(String v)       { this.feltColour = v;      this.updatedAt = LocalDateTime.now(); }
    public void setAnimationsEnabled(boolean v){ this.animationsEnabled = v; this.updatedAt = LocalDateTime.now(); }
    public void setStockSide(String v)        { this.stockSide = v;       this.updatedAt = LocalDateTime.now(); }
    public void setAnimationSpeed(String v)   { this.animationSpeed = v;  this.updatedAt = LocalDateTime.now(); }
    public void setWinAnimation(String v)     { this.winAnimation = v;    this.updatedAt = LocalDateTime.now(); }
}
