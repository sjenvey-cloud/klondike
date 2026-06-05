-- V25 (DEV-310): APNs device tokens for push notifications.
--
-- One row per (user, device). A device re-registering with a refreshed APNs
-- token updates the existing row (upsert keyed on user_id + device_id).
-- A given APNs token is owned by exactly one row — when it re-appears for a
-- different user/device (e.g. account switch on the same handset), the prior
-- owner's row is removed so notifications never deliver to the wrong account.
CREATE TABLE device_tokens (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     INTEGER      NOT NULL,
    device_id   VARCHAR(255) NOT NULL,   -- UIDevice.identifierForVendor
    token       VARCHAR(512) NOT NULL,   -- APNs device token (hex)
    platform    VARCHAR(20)  NOT NULL DEFAULT 'ios',
    created_at  TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT now(),

    CONSTRAINT fk_device_tokens_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_device_tokens_user_device
        UNIQUE (user_id, device_id)
);

-- Fast lookup of all tokens for a user when sending a notification.
CREATE INDEX idx_device_tokens_user ON device_tokens (user_id);

-- Fast cleanup of stale ownership when the same token re-registers.
CREATE INDEX idx_device_tokens_token ON device_tokens (token);
