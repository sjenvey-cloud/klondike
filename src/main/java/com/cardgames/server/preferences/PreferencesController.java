package com.cardgames.server.preferences;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Preferences", description = "User display and gameplay preferences (draw mode, card design, animation, theme)")
@CrossOrigin(origins = {
    "http://localhost:4200",
    "http://localhost:5173",
    "https://dbk2b6k1kyjsy.cloudfront.net",
    "https://d2fbehwb6bp7kq.cloudfront.net",
    "https://klondikepro.app",
    "https://www.klondikepro.app"
})
@RestController
@RequestMapping("/api/v1/profile/preferences")
public class PreferencesController {

    private final UserPreferencesRepository prefsRepo;

    public PreferencesController(UserPreferencesRepository prefsRepo) {
        this.prefsRepo = prefsRepo;
    }

    // GET /api/v1/profile/preferences
    @Operation(summary = "Get user preferences (creates defaults on first call)")
    @GetMapping
    public ResponseEntity<UserPreferences> getPreferences(Authentication auth) {
        int userId = (Integer) auth.getPrincipal();
        UserPreferences prefs = prefsRepo.findByUserId(userId)
            .orElseGet(() -> prefsRepo.save(new UserPreferences(userId)));
        return ResponseEntity.ok(prefs);
    }

    // PATCH /api/v1/profile/preferences
    @Operation(summary = "Update one or more preferences (partial update — omit fields to leave unchanged)")
    @PatchMapping
    public ResponseEntity<UserPreferences> patchPreferences(
            @RequestBody PatchPreferencesRequest body,
            Authentication auth) {

        int userId = (Integer) auth.getPrincipal();
        UserPreferences prefs = prefsRepo.findByUserId(userId)
            .orElseGet(() -> new UserPreferences(userId));

        if (body.drawModeDefault()  != null) prefs.setDrawModeDefault(body.drawModeDefault());
        if (body.cardFaceDesign()   != null) prefs.setCardFaceDesign(body.cardFaceDesign());
        if (body.cardStyle()       != null) prefs.setCardStyle(body.cardStyle());
        if (body.cardBackColour()   != null) prefs.setCardBackColour(body.cardBackColour());
        if (body.cardBackPattern()  != null) prefs.setCardBackPattern(
            body.cardBackPattern().isEmpty() ? null : body.cardBackPattern());
        if (body.feltColour()       != null) prefs.setFeltColour(body.feltColour());
        if (body.animationsEnabled() != null) prefs.setAnimationsEnabled(body.animationsEnabled());
        if (body.stockSide()         != null) prefs.setStockSide(body.stockSide());
        if (body.animationSpeed()    != null) prefs.setAnimationSpeed(body.animationSpeed());
        if (body.winAnimation()      != null) prefs.setWinAnimation(body.winAnimation());

        // DEV-314: daily reminder. "" (or blank) disables; "HH:mm" enables.
        if (body.dailyReminderTime() != null) {
            if (body.dailyReminderTime().isBlank()) {
                prefs.setDailyReminderTime(null);
                prefs.setDailyReminderLastSent(null);
            } else {
                try {
                    prefs.setDailyReminderTime(
                        java.time.LocalTime.parse(body.dailyReminderTime()));
                } catch (java.time.format.DateTimeParseException e) {
                    return ResponseEntity.badRequest().build();
                }
            }
        }
        if (body.dailyReminderTzOffset() != null) {
            prefs.setDailyReminderTzOffset(body.dailyReminderTzOffset());
        }

        prefsRepo.save(prefs);
        return ResponseEntity.ok(prefs);
    }
}
