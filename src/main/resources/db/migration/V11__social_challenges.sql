-- Social challenges: group challenges sent to all friends
CREATE TABLE social_challenges (
    id                  SERIAL      PRIMARY KEY,
    creator_user_id     INT         NOT NULL,
    hand_id             INT         NOT NULL,
    creator_session_id  INT         NOT NULL,
    draw_mode           VARCHAR(10) NOT NULL DEFAULT 'draw3',
    status              VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at          TIMESTAMP   NOT NULL DEFAULT NOW(),
    ended_at            TIMESTAMP
);

-- One row per friend invited at challenge creation time
CREATE TABLE social_challenge_participants (
    id              SERIAL      PRIMARY KEY,
    challenge_id    INT         NOT NULL REFERENCES social_challenges(id),
    user_id         INT         NOT NULL,
    added_at        TIMESTAMP   NOT NULL DEFAULT NOW(),
    UNIQUE (challenge_id, user_id)
);

CREATE INDEX idx_sc_creator ON social_challenges(creator_user_id);
CREATE INDEX idx_scp_challenge ON social_challenge_participants(challenge_id);
CREATE INDEX idx_scp_user ON social_challenge_participants(user_id);
