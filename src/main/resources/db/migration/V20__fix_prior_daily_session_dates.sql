-- V20: Fix daily sessions created with the wrong daily_date.
--
-- Root cause: the inline prior-daily feature introduced in b6adc7f passed
-- `dailyDate: today` to startGame regardless of which past date was being
-- played. Sessions for past daily challenges were therefore stored with
-- daily_date = the play date (e.g. 2026-05-14) instead of the challenge
-- date (e.g. 2026-05-06), causing them to be invisible on the correct
-- leaderboard.
--
-- Fix: for every daily session whose daily_date does not match the
-- canonical challenge date recorded in daily_challenges, update daily_date
-- to the correct value. We join on hand_id to find the authoritative date.
--
-- Safety conditions:
--   - Only daily sessions (is_daily = true)
--   - Only where the hand appears in daily_challenges with a different date
--   - Only sessions started on or after 2026-05-14 (the day the bug was
--     introduced — prior sessions used the old navigate-to-/game path which
--     correctly received replayDailyDate from location.state)

UPDATE sessions s
SET    daily_date = dc.challenge_date
FROM   daily_challenges dc
WHERE  s.hand_id    = dc.hand_id
  AND  s.is_daily   = true
  AND  s.daily_date <> dc.challenge_date
  AND  s.started_at >= '2026-05-14';
