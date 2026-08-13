-- Connect Requests feature.

-- Device region shown in the "Connect Requests" list (client-provided country).
ALTER TABLE users ADD COLUMN location VARCHAR(100);

-- Records that a friend request the user SENT was accepted, so the requester can
-- see it (badge + acknowledgment) until they next open the Social tab. The
-- friend_requests row itself is still deleted on accept; this is a lightweight,
-- transient acknowledgment that doesn't touch that lifecycle.
CREATE TABLE friend_acceptances (
    id           SERIAL PRIMARY KEY,
    requester_id INTEGER   NOT NULL,   -- the original requester (who to notify)
    acceptor_id  INTEGER   NOT NULL,   -- who accepted the request
    created_at   TIMESTAMP NOT NULL DEFAULT now(),
    seen         BOOLEAN   NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_friend_acceptances_requester ON friend_acceptances(requester_id, seen);
