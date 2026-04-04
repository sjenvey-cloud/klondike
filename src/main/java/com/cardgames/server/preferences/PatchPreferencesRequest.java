package com.cardgames.server.preferences;

public record PatchPreferencesRequest(
    String  drawModeDefault,
    String  cardFaceDesign,
    String  cardBackColour,
    String  feltColour,
    Boolean animationsEnabled
) {}
