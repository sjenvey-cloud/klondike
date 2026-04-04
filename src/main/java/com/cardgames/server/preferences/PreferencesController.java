package com.cardgames.server.preferences;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@CrossOrigin(origins = {
    "http://localhost:3000",
    "http://localhost:4200",
    "http://localhost:5173",
    "https://dbk2b6k1kyjsy.cloudfront.net"
})
@RestController
@RequestMapping("/api/v1/profile/preferences")
public class PreferencesController {

    private final UserPreferencesRepository prefsRepo;

    public PreferencesController(UserPreferencesRepository prefsRepo) {
        this.prefsRepo = prefsRepo;
    }

    // GET /api/v1/profile/preferences
    @GetMapping
    public ResponseEntity<UserPreferences> getPreferences(Authentication auth) {
        int userId = (Integer) auth.getPrincipal();
        UserPreferences prefs = prefsRepo.findByUserId(userId)
            .orElseGet(() -> prefsRepo.save(new UserPreferences(userId)));
        return ResponseEntity.ok(prefs);
    }

    // PATCH /api/v1/profile/preferences
    @PatchMapping
    public ResponseEntity<UserPreferences> patchPreferences(
            @RequestBody PatchPreferencesRequest body,
            Authentication auth) {

        int userId = (Integer) auth.getPrincipal();
        UserPreferences prefs = prefsRepo.findByUserId(userId)
            .orElseGet(() -> new UserPreferences(userId));

        if (body.drawModeDefault()  != null) prefs.setDrawModeDefault(body.drawModeDefault());
        if (body.cardFaceDesign()   != null) prefs.setCardFaceDesign(body.cardFaceDesign());
        if (body.cardBackColour()   != null) prefs.setCardBackColour(body.cardBackColour());
        if (body.feltColour()       != null) prefs.setFeltColour(body.feltColour());
        if (body.animationsEnabled() != null) prefs.setAnimationsEnabled(body.animationsEnabled());

        prefsRepo.save(prefs);
        return ResponseEntity.ok(prefs);
    }
}
