-- V6__daily_sessions.sql
-- DEV-106: Tracks whether a session is a daily challenge attempt and
-- enforces one ranked attempt per user per day per draw mode.

ALTER TABLE sessions
    ADD COLUMN is_daily   BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN daily_date DATE    NULL,
    ADD COLUMN is_ranked  BOOLEAN NOT NULL DEFAULT TRUE;

-- Unique index: one ranked completed attempt per user per day per draw mode.
-- Partial index — only applies once a daily session reaches a terminal status.
CREATE UNIQUE INDEX idx_one_ranked_daily
    ON sessions(user_id, daily_date, draw_mode)
    WHERE is_daily = TRUE
      AND is_ranked = TRUE
      AND status IN ('won', 'abandoned');
