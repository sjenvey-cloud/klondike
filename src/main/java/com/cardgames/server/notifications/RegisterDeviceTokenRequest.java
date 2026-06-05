package com.cardgames.server.notifications;

import jakarta.validation.constraints.NotBlank;

/**
 * DEV-310: body for POST /api/v1/profile/device-token.
 * `platform` is optional and defaults to "ios".
 */
public record RegisterDeviceTokenRequest(
    @NotBlank String token,
    @NotBlank String deviceId,
    String platform
) {
    public String platformOrDefault() {
        return (platform == null || platform.isBlank()) ? "ios" : platform;
    }
}
