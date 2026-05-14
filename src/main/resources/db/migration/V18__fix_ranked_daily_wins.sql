-- V18: Fix daily ranked-win sessions incorrectly saved as isRanked=false
--
-- Root cause: createSession briefly checked STATUS_WON + STATUS_ABANDONED when
-- determining whether the user's ranked slot was taken. This caused every
-- session after an abandoned ranked attempt to be created as isRanked=false,
-- even though the abandonSession demotion logic correctly clears the slot.
--
-- Step 1: Demote abandoned ranked daily sessions whose (user, date, mode)
-- already has a won session. These abandoned sessions were blocking the
-- leaderboard but serve no purpose now that a win exists.
UPDATE sessions
SET is_ranked = false
WHERE status    = 'abandoned'
  AND is_daily  = true
  AND is_ranked = true
  AND EXISTS (
      SELECT 1
      FROM   sessions w
      WHERE  w.user_id    = sessions.user_id
        AND  w.daily_date = sessions.daily_date
        AND  w.draw_mode  = sessions.draw_mode
        AND  w.is_daily   = true
        AND  w.status     = 'won'
  );

-- Step 2: For each (user, date, mode) that has won sessions but NO ranked win,
-- promote the earliest win (by completed_at) to isRanked=true.
-- This restores the ranked slot for users whose first win was incorrectly
-- saved as isRanked=false.
WITH first_unranked_wins AS (
    SELECT DISTINCT ON (user_id, daily_date, draw_mode)
           id
    FROM   sessions
    WHERE  is_daily  = true
      AND  status    = 'won'
      AND  NOT EXISTS (
               SELECT 1
               FROM   sessions r
               WHERE  r.user_id    = sessions.user_id
                 AND  r.daily_date = sessions.daily_date
                 AND  r.draw_mode  = sessions.draw_mode
                 AND  r.is_daily   = true
                 AND  r.is_ranked  = true
                 AND  r.status     = 'won'
           )
    ORDER BY user_id, daily_date, draw_mode, completed_at ASC
)
UPDATE sessions
SET    is_ranked = true
WHERE  id IN (SELECT id FROM first_unranked_wins);
