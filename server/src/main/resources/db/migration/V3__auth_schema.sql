-- V3__auth_schema.sql
-- Adds authentication columns to users and creates identity / refresh-token tables.

ALTER TABLE users
    ADD COLUMN email         VARCHAR(255),
    ADD COLUMN password_hash VARCHAR(255),
    ADD COLUMN display_name  VARCHAR(100);

-- Partial unique index: allows existing NULL emails, enforces uniqueness for non-NULL
CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;

-- Tracks which external / local provider authenticated a user.
-- Supports future OAuth providers alongside the initial 'local' (email+password) provider.
CREATE TABLE user_identities (
    id               SERIAL      PRIMARY KEY,
    user_id          INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider         VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    created_at       TIMESTAMP   NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_identity_provider UNIQUE (provider, provider_user_id)
);

CREATE INDEX idx_user_identities_user_id ON user_identities(user_id);

-- Stores hashed refresh tokens for rotation and revocation.
-- The raw token is a UUID sent to the client; only its SHA-256 hex digest is persisted.
CREATE TABLE refresh_tokens (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64)  NOT NULL,
    expires_at TIMESTAMP    NOT NULL,
    revoked    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_refresh_token_hash UNIQUE (token_hash)
);

CREATE INDEX idx_refresh_tokens_user_id   ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
