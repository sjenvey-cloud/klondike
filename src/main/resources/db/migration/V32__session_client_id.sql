-- Offline mode: a client-generated idempotency key for sessions.
--
-- Games played offline are recorded via POST /sessions/offline once connectivity
-- returns. client_id lets that endpoint be safely retried any number of times
-- without creating duplicate sessions (the client keeps retrying a queued result
-- until the server confirms it). Also fixes the "couldn't save" false error, where a
-- lost/slow response made the client retry a completion it had actually saved.
ALTER TABLE sessions ADD COLUMN client_id UUID;

CREATE UNIQUE INDEX idx_sessions_client_id ON sessions (client_id) WHERE client_id IS NOT NULL;
