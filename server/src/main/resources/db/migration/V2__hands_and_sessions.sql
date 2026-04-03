-- V2__hands_and_sessions.sql
-- Introduces hands (seeded shuffles) and sessions (a user playing a hand).
-- Replaces the deck/deal model for all new API interactions.

CREATE TABLE hands (
    id           SERIAL PRIMARY KEY,
    shuffle_seed BIGINT NOT NULL UNIQUE,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
    id           SERIAL PRIMARY KEY,
    hand_id      INT NOT NULL REFERENCES hands(id),
    user_id      INT NOT NULL REFERENCES users(id),
    status       VARCHAR(20) NOT NULL DEFAULT 'active',
    moves        INT NOT NULL DEFAULT 0,
    time_seconds INT NOT NULL DEFAULT 0,
    turns        TEXT,
    started_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP NULL
);

CREATE INDEX idx_sessions_hand_id ON sessions(hand_id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_status  ON sessions(status);
