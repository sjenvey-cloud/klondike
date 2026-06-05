-- V27: allow unlimited ranked attempts on the *current day's* daily challenge so
-- players can retry and improve. The daily leaderboard already selects each user's
-- best won session per metric (DISTINCT ON), so multiple ranked wins are handled
-- correctly — the old one-ranked-per-day constraint only blocked improvement and
-- forced confusing "practice" retries.
--
-- Past dailies remain practice (enforced in SessionController by date == today).
DROP INDEX IF EXISTS idx_one_ranked_daily;
