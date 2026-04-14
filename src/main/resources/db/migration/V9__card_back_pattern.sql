-- DEV-175: Add card_back_pattern column to user_preferences
-- Stores a URL to an SVG tile pattern, or NULL for flat colour mode.
ALTER TABLE user_preferences
    ADD COLUMN card_back_pattern VARCHAR(512) NULL;
