package com.cardgames.server.notifications;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * DEV-310: an APNs device token registered by a user's device.
 * One row per (user_id, device_id); the token is updated in place when a
 * device re-registers with a refreshed APNs token.
 */
@Entity
@Table(name = "device_tokens")
public class DeviceToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long id;

    @Column(name = "user_id", nullable = false)
    private int userId;

    @Column(name = "device_id", nullable = false)
    private String deviceId;

    @Column(name = "token", nullable = false)
    private String token;

    @Column(name = "platform", nullable = false)
    private String platform = "ios";

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public DeviceToken() {}

    public DeviceToken(int userId, String deviceId, String token, String platform) {
        this.userId    = userId;
        this.deviceId  = deviceId;
        this.token     = token;
        this.platform  = platform;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    /** Update the token after a refresh and bump updated_at. */
    public void refresh(String token, String platform) {
        this.token     = token;
        this.platform  = platform;
        this.updatedAt = LocalDateTime.now();
    }

    public long          getId()        { return id; }
    public int           getUserId()    { return userId; }
    public String        getDeviceId()  { return deviceId; }
    public String        getToken()     { return token; }
    public String        getPlatform()  { return platform; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
