package com.cardgames.server.notifications;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/**
 * DEV-310: register an APNs device token for the authenticated user.
 *
 * Upsert keyed on (user_id, device_id): a device re-registering with a refreshed
 * token updates its existing row. The token is first cleared from any other row
 * (e.g. a different account previously used on the same handset) so a given APNs
 * token is only ever owned by the most recent registrant.
 */
@Tag(name = "Notifications", description = "APNs device token registration for push notifications")
@CrossOrigin(origins = {
    "http://localhost:4200",
    "http://localhost:5173",
    "https://dbk2b6k1kyjsy.cloudfront.net",
    "https://d2fbehwb6bp7kq.cloudfront.net",
    "https://klondikepro.app",
    "https://www.klondikepro.app"
})
@RestController
@RequestMapping("/api/v1/profile")
public class DeviceTokenController {

    private final DeviceTokenRepository repository;

    public DeviceTokenController(DeviceTokenRepository repository) {
        this.repository = repository;
    }

    @Operation(
        summary     = "Register or refresh this device's APNs token",
        description = "Authenticated. Upserts on (user, device). Replaces the old token for the "
                    + "same device and removes the token from any other account that previously held it.")
    @PostMapping("/device-token")
    @Transactional
    public ResponseEntity<Void> register(
            @Valid @RequestBody RegisterDeviceTokenRequest body,
            Authentication auth) {

        int userId = (Integer) auth.getPrincipal();

        // A given APNs token belongs to exactly one (user, device) — clear stale ownership first.
        repository.deleteByToken(body.token());

        repository.findByUserIdAndDeviceId(userId, body.deviceId())
            .ifPresentOrElse(
                existing -> {
                    existing.refresh(body.token(), body.platformOrDefault());
                    repository.save(existing);
                },
                () -> repository.save(new DeviceToken(
                    userId, body.deviceId(), body.token(), body.platformOrDefault()))
            );

        return ResponseEntity.noContent().build();
    }
}
