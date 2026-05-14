-- V19: Close daily sessions stuck in 'active' status due to the
-- idx_one_ranked_daily constraint violation (abandonSession was throwing 500,
-- rolling back the transaction and leaving sessions as 'active' permanently).
--
-- These orphaned active daily sessions were polluting the profile calendar.
-- We close them as 'abandoned' (their actual logical state) and demote them
-- to isRanked=false since they never completed and should not affect rankings.
--
-- Safety guard: only touch daily sessions started more than 2 hours ago,
-- so no genuinely in-progress game is accidentally closed.

UPDATE sessions
SET    status       = 'abandoned',
       is_ranked    = false,
       completed_at = started_at
WHERE  is_daily     = true
  AND  status       = 'active'
  AND  started_at   < NOW() - INTERVAL '2 hours';
