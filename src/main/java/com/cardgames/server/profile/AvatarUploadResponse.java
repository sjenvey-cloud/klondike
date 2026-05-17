package com.cardgames.server.profile;

/** Response for POST /api/v1/profile/avatar. */
public record AvatarUploadResponse(
    String uploadUrl,   // presigned S3 PUT URL (15-min TTL) — client PUTs the file here
    String publicUrl    // final CDN URL to persist via PATCH /profile/avatar
) {}
