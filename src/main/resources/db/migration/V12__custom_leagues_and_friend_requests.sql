-- V12: Custom named leagues + direct in-app friend requests

-- Custom leagues (user-created named groups, separate from the friends league)
CREATE TABLE custom_leagues (
    id              SERIAL       PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    creator_user_id INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- League membership (creator is added automatically as a member on creation)
CREATE TABLE custom_league_members (
    id         SERIAL    PRIMARY KEY,
    league_id  INT       NOT NULL REFERENCES custom_leagues(id) ON DELETE CASCADE,
    user_id    INT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (league_id, user_id)
);

-- Direct in-app friend requests (used when adding a league member who isn't a friend)
CREATE TABLE friend_requests (
    id           SERIAL    PRIMARY KEY,
    requester_id INT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requestee_id INT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_friend_request UNIQUE (requester_id, requestee_id)
);

CREATE INDEX idx_clm_league    ON custom_league_members(league_id);
CREATE INDEX idx_clm_user      ON custom_league_members(user_id);
CREATE INDEX idx_fr_requestee  ON friend_requests(requestee_id);
CREATE INDEX idx_fr_requester  ON friend_requests(requester_id);
