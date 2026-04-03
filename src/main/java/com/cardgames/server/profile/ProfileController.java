package com.cardgames.server.profile;

import com.cardgames.server.user.User;
import com.cardgames.server.user.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/v1/profile")
public class ProfileController {

    private final UserRepository userRepository;

    public ProfileController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    // ── DEV-81: GET /api/v1/profile ───────────────────────────────────────

    @GetMapping
    public ResponseEntity<ProfileResponse> getProfile(Authentication auth) {
        User user = resolveUser(auth);
        return ResponseEntity.ok(toResponse(user));
    }

    // ── DEV-82: PATCH /api/v1/profile ─────────────────────────────────────

    @PatchMapping
    public ResponseEntity<ProfileResponse> patchProfile(
            @Valid @RequestBody PatchProfileRequest body,
            Authentication auth) {

        User user = resolveUser(auth);
        user.setDisplayName(body.displayName());
        user.setUsername(body.displayName()); // keep username in sync
        userRepository.save(user);
        return ResponseEntity.ok(toResponse(user));
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private User resolveUser(Authentication auth) {
        int userId = (Integer) auth.getPrincipal();
        return userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private ProfileResponse toResponse(User user) {
        return new ProfileResponse(
            user.getId(),
            user.getDisplayName(),
            user.getEmail(),
            user.getdatecreated(),
            user.getlasthand()
        );
    }
}
