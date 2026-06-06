-- V28 (DEV-337): record the selected felt theme by NAME, not just hex, so a
-- named theme (dark-premium / classic-felt / modern-minimal) survives future
-- tweaks to its canonical hex and is recognised identically on web and iOS.
--
-- Nullable: null means "custom felt colour" (a swatch that isn't a named theme).
-- Existing rows are backfilled from their current felt_colour where it matches a
-- canonical theme hex; everything else is left null (custom).
ALTER TABLE user_preferences
    ADD COLUMN theme_name VARCHAR(40);

UPDATE user_preferences SET theme_name = 'dark-premium'   WHERE lower(felt_colour) = '#0d1117';
UPDATE user_preferences SET theme_name = 'classic-felt'   WHERE lower(felt_colour) = '#1a5c2e';
UPDATE user_preferences SET theme_name = 'modern-minimal' WHERE lower(felt_colour) = '#2d2d2d';
