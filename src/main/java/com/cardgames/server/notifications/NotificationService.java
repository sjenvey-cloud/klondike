package com.cardgames.server.notifications;

import com.eatthepath.pushy.apns.ApnsClient;
import com.eatthepath.pushy.apns.ApnsClientBuilder;
import com.eatthepath.pushy.apns.auth.ApnsSigningKey;
import com.eatthepath.pushy.apns.util.SimpleApnsPayloadBuilder;
import com.eatthepath.pushy.apns.util.SimpleApnsPushNotification;
import com.eatthepath.pushy.apns.util.TokenUtil;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * DEV-311: sends APNs push notifications via Pushy (token-based .p8 auth).
 *
 * <p><b>Config-gated:</b> if the APNs key material isn't provided
 * (`apns.key-p8` / `apns.key-id` / `apns.team-id`), the service initialises in a
 * disabled state and every {@link #sendToUser} call is a silent no-op. This keeps
 * the rest of the app fully functional before the APNs key is set up — nothing
 * throws, startup is unaffected, and the notification triggers can be wired in now.
 *
 * <p>Provide the key via environment variables (mapped in application.properties):
 * <ul>
 *   <li>{@code APNS_KEY_P8} — the full PEM contents of the AuthKey_XXXX.p8 file</li>
 *   <li>{@code APNS_KEY_ID} — 10-char key ID</li>
 *   <li>{@code APNS_TEAM_ID} — 10-char Apple team ID</li>
 *   <li>{@code APNS_BUNDLE_ID} — APNs topic (defaults to com.klondikepro.app)</li>
 *   <li>{@code APNS_PRODUCTION} — true for the production APNs host (default false)</li>
 * </ul>
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final DeviceTokenRepository tokenRepo;
    private final String  bundleId;
    private final boolean enabled;
    private ApnsClient apnsClient;   // null when disabled

    public NotificationService(
            DeviceTokenRepository tokenRepo,
            @Value("${apns.key-p8:}")   String keyP8,
            @Value("${apns.key-id:}")   String keyId,
            @Value("${apns.team-id:}")  String teamId,
            @Value("${apns.bundle-id:com.klondikepro.app}") String bundleId,
            @Value("${apns.production:false}") boolean production) {

        this.tokenRepo = tokenRepo;
        this.bundleId  = bundleId;

        boolean ok = false;
        if (!keyP8.isBlank() && !keyId.isBlank() && !teamId.isBlank()) {
            try {
                ApnsSigningKey signingKey = ApnsSigningKey.loadFromInputStream(
                        new ByteArrayInputStream(keyP8.getBytes(StandardCharsets.UTF_8)),
                        teamId, keyId);
                this.apnsClient = new ApnsClientBuilder()
                        .setApnsServer(production
                                ? ApnsClientBuilder.PRODUCTION_APNS_HOST
                                : ApnsClientBuilder.DEVELOPMENT_APNS_HOST)
                        .setSigningKey(signingKey)
                        .build();
                ok = true;
                log.info("APNs NotificationService initialised ({} host, topic {})",
                        production ? "production" : "development", bundleId);
            } catch (Exception e) {
                log.warn("APNs key present but initialisation failed — push disabled: {}", e.getMessage());
            }
        } else {
            log.info("APNs not configured (apns.key-p8/key-id/team-id missing) — push notifications disabled");
        }
        this.enabled = ok;
    }

    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Sends a notification to every device registered to a user. Runs asynchronously
     * so callers (request handlers, schedulers) never block on APNs. No-op if disabled.
     */
    @Async
    public void sendToUser(int userId, String title, String body, Map<String, String> customData) {
        if (!enabled) return;
        List<DeviceToken> tokens = tokenRepo.findByUserId(userId);
        for (DeviceToken dt : tokens) {
            try {
                sendOne(dt, title, body, customData);
            } catch (Exception e) {
                log.warn("Failed to dispatch APNs push to token {}: {}", dt.getId(), e.getMessage());
            }
        }
    }

    private void sendOne(DeviceToken dt, String title, String body, Map<String, String> customData) {
        SimpleApnsPayloadBuilder payloadBuilder = new SimpleApnsPayloadBuilder();
        payloadBuilder.setAlertTitle(title);
        payloadBuilder.setAlertBody(body);
        payloadBuilder.setSound("default");
        if (customData != null) {
            customData.forEach(payloadBuilder::addCustomProperty);
        }
        String payload = payloadBuilder.build();
        String token   = TokenUtil.sanitizeTokenString(dt.getToken());

        SimpleApnsPushNotification push = new SimpleApnsPushNotification(token, bundleId, payload);

        apnsClient.sendNotification(push).whenComplete((response, cause) -> {
            if (cause != null) {
                log.warn("APNs send error for user {}: {}", dt.getUserId(), cause.getMessage());
                return;
            }
            if (!response.isAccepted()) {
                String reason = response.getRejectionReason().orElse("unknown");
                log.info("APNs rejected token for user {}: {}", dt.getUserId(), reason);
                // Permanently-invalid tokens should be pruned so we stop trying them.
                if ("BadDeviceToken".equals(reason)
                        || "Unregistered".equals(reason)
                        || "DeviceTokenNotForTopic".equals(reason)) {
                    try {
                        tokenRepo.deleteById(dt.getId());
                    } catch (Exception ignored) {
                        // best-effort cleanup
                    }
                }
            }
        });
    }

    @PreDestroy
    public void shutdown() {
        if (apnsClient != null) {
            apnsClient.close();
        }
    }
}
