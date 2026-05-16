package com.cardgames.server.preferences;

public record PatchPreferencesRequest(
    String  drawModeDefault,
    String  cardFaceDesign,
    String  cardStyle,
    String  cardBackColour,
    String  cardBackPattern,
    String  feltColour,
    Boolean animationsEnabled,
    String  stockSide,
    String  animationSpeed,
    String  winAnimation
) {}
