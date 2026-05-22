package com.cardgames.server.profile;

import com.cardgames.server.user.User;
import com.cardgames.server.user.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.Set;
import java.util.UUID;

/**
 * DEV-229: Avatar upload endpoints.
 *
 * Flow:
 *  1. Client POSTs { contentType } → receives { uploadUrl, publicUrl }
 *  2. Client PUTs the image file directly to the S3 presigned uploadUrl
 *  3. Client PATCHes { avatarUrl: publicUrl } → saves CDN URL on the user row
 */
@Tag(name = "Avatar", description = "Profile avatar upload via S3 presigned PUT URL")
@RestController
@RequestMapping("/api/v1/profile")
public class AvatarController {

    private static final Logger log = LoggerFactory.getLogger(AvatarController.class);

    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png");

    private final UserRepository userRepository;
    private final S3Presigner    presigner;
    private final String         bucket;
    private final String         cdnBaseUrl;

    public AvatarController(
            UserRepository userRepository,
            S3Presigner presigner,
            @Value("${app.avatar.bucket}") String bucket,
            @Value("${app.avatar.cdn-url}") String cdnBaseUrl) {
        this.userRepository = userRepository;
        this.presigner      = presigner;
        this.bucket         = bucket;
        this.cdnBaseUrl     = cdnBaseUrl;
    }

    /**
     * POST /api/v1/profile/avatar
     * Body: { "contentType": "image/jpeg" | "image/png" }
     * Returns a 15-minute presigned PUT URL and the final CDN URL to save after upload.
     */
    @Operation(summary = "Request a presigned S3 PUT URL for avatar upload", description = "Step 1 of 2: client receives uploadUrl and publicUrl. PUT the image file to uploadUrl, then PATCH /profile/avatar with publicUrl.")
    @PostMapping("/avatar")
    public ResponseEntity<AvatarUploadResponse> requestUploadUrl(
            @RequestBody AvatarUploadRequest req,
            Authentication auth) {

        if (req.contentType() == null || !ALLOWED_TYPES.contains(req.contentType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "contentType must be image/jpeg or image/png");
        }

        int    userId = (Integer) auth.getPrincipal();
        String ext    = "image/png".equals(req.contentType()) ? "png" : "jpg";
        String key    = "avatars/" + userId + "/" + UUID.randomUUID() + "." + ext;

        PutObjectRequest putReq = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(req.contentType())
                .build();

        PutObjectPresignRequest presignReq = PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(15))
                .putObjectRequest(putReq)
                .build();

        PresignedPutObjectRequest presigned = presigner.presignPutObject(presignReq);

        String uploadUrl = presigned.url().toString();
        log.info("Avatar presign: userId={} key={} uploadHost={}", userId, key, presigned.url().getHost());
        String publicUrl = cdnBaseUrl.stripTrailing() + "/" + key;

        return ResponseEntity.ok(new AvatarUploadResponse(uploadUrl, publicUrl));
    }

    /**
     * PATCH /api/v1/profile/avatar
     * Body: { "avatarUrl": "https://cdn.example.com/avatars/..." }
     * Saves the CDN URL on the authenticated user's account.
     */
    @Operation(summary = "Confirm avatar upload — save CDN URL on the user account", description = "Step 2 of 2: call after a successful PUT to the presigned URL.")
    @PatchMapping("/avatar")
    public ResponseEntity<ProfileResponse> confirmUpload(
            @RequestBody AvatarConfirmRequest req,
            Authentication auth) {

        int  userId = (Integer) auth.getPrincipal();
        User user   = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        user.setAvatarUrl(req.avatarUrl());
        userRepository.save(user);

        return ResponseEntity.ok(new ProfileResponse(
                user.getUuid(),
                user.getDisplayName(),
                user.getEmail(),
                user.getdatecreated(),
                user.getlasthand(),
                user.getAvatarUrl()
        ));
    }
}
