package com.cardgames.server.profile;

/** Body for PATCH /api/v1/profile/avatar — saves the CDN URL after a successful S3 upload. */
public record AvatarConfirmRequest(String avatarUrl) {}
