package com.cardgames.server.profile;

/** Body for POST /api/v1/profile/avatar — requests a presigned S3 upload URL. */
public record AvatarUploadRequest(String contentType) {}
