-- V4__user_preferences.sql
-- DEV-126: Per-user personalisation preferences for card face design,
-- card back colour, felt colour, default draw mode, and animation toggle.

CREATE TABLE user_preferences (
    user_id             INT         PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    draw_mode_default   VARCHAR(10) NOT NULL DEFAULT 'draw3',
    card_face_design    VARCHAR(20) NOT NULL DEFAULT 'standard',
    card_back_colour    VARCHAR(7)  NOT NULL DEFAULT '#1c2333',
    felt_colour         VARCHAR(7)  NOT NULL DEFAULT '#0d1117',
    animations_enabled  BOOLEAN     NOT NULL DEFAULT TRUE,
    updated_at          TIMESTAMP   NOT NULL DEFAULT NOW()
);
