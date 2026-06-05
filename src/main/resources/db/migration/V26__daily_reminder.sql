-- V26 (DEV-314): per-user daily-challenge reminder settings.
--
-- daily_reminder_time      — local time-of-day the user wants the reminder; NULL = disabled.
-- daily_reminder_tz_offset — minutes east of UTC, captured when the user set the time,
--                            so the scheduler can fire at the user's local time.
-- daily_reminder_last_sent — local date the reminder was last delivered; de-dupes to
--                            at most one reminder per local day.
ALTER TABLE user_preferences
    ADD COLUMN daily_reminder_time      TIME    NULL,
    ADD COLUMN daily_reminder_tz_offset INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN daily_reminder_last_sent DATE    NULL;
