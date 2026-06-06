package com.cardgames.server.preferences;

public record PatchPreferencesRequest(
    String  drawModeDefault,
    String  cardFaceDesign,
    String  cardStyle,
    String  cardBackColour,
    String  cardBackPattern,
    String  feltColour,
    String  themeName,        // DEV-337: canonical theme name, or "custom"
    Boolean animationsEnabled,
    String  stockSide,
    String  animationSpeed,
    String  winAnimation,
    // DEV-314: "HH:mm" local time to enable the daily reminder, or "" to disable.
    // dailyReminderTzOffset is minutes east of UTC, sent alongside the time.
    String  dailyReminderTime,
    Integer dailyReminderTzOffset
) {}
