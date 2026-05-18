package com.cardgames.server.auth;

import jakarta.validation.constraints.NotBlank;

/**
 * DEV-250: Request body for POST /api/v1/auth/game-center.
 *
 * All fields except displayName come from the iOS GameKit identity
 * verification signature fetch. The backend verifies the ECDSA signature
 * against Apple's public key before issuing a JWT pair.
 */
public record GameCenterAuthRequest(

        /** GKLocalPlayer.teamPlayerID — stable across devices for the same Apple ID. */
        @NotBlank String playerId,

        /** The app's bundle ID — must match com.klondikepro.app in production. */
        @NotBlank String bundleId,

        /** URL of Apple's X.509 public key certificate (must be on *.apple.com). */
        @NotBlank String publicKeyUrl,

        /** Base64-encoded ECDSA signature returned by fetchItemsForIdentityVerificationSignature. */
        @NotBlank String signature,

        /** Base64-encoded random salt included in the signed payload. */
        @NotBlank String salt,

        /** UInt64 timestamp (seconds since 1970-01-01) included in the signed payload. */
        long timestamp,

        /**
         * Optional display name from GKLocalPlayer.displayName.
         * Used only when creating a brand-new account; ignored for existing users.
         */
        String displayName
) {}
