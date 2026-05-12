-- Sprint 19 / DEV-209: Add UUID columns to users, sessions, and hands.
-- Integer PKs remain as internal DB keys for FK relationships.
-- UUIDs are the public-facing identifiers for all API consumers.

-- 1. Add UUID to users
ALTER TABLE users
    ADD COLUMN uuid UUID NOT NULL DEFAULT gen_random_uuid();

-- 2. Add UUID to hands
ALTER TABLE hands
    ADD COLUMN uuid UUID NOT NULL DEFAULT gen_random_uuid();

-- 3. Add UUID and denormalized hand_uuid to sessions
--    hand_uuid is copied from hands.uuid at migration time and maintained
--    by the application on every new session insert, avoiding a join on reads.
ALTER TABLE sessions
    ADD COLUMN uuid      UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN hand_uuid UUID;

UPDATE sessions s
    SET hand_uuid = (SELECT uuid FROM hands h WHERE h.id = s.hand_id);

ALTER TABLE sessions
    ALTER COLUMN hand_uuid SET NOT NULL;

-- 4. Unique indexes (queries by UUID must be fast)
CREATE UNIQUE INDEX idx_users_uuid    ON users(uuid);
CREATE UNIQUE INDEX idx_hands_uuid    ON hands(uuid);
CREATE UNIQUE INDEX idx_sessions_uuid ON sessions(uuid);
