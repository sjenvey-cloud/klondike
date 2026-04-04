-- V5__draw_mode.sql
-- DEV-110: Adds draw_mode to hands and sessions so the server can enforce
-- the correct draw count during replay validation, and leaderboards can be
-- split by mode.

ALTER TABLE hands    ADD COLUMN draw_mode VARCHAR(10) NOT NULL DEFAULT 'draw3';
ALTER TABLE sessions ADD COLUMN draw_mode VARCHAR(10) NOT NULL DEFAULT 'draw3';
