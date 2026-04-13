-- DEV-154: friends and friend_invites tables

CREATE TABLE friends (
    id          SERIAL PRIMARY KEY,
    user_id_a   INT       NOT NULL,  -- always the lower user id
    user_id_b   INT       NOT NULL,  -- always the higher user id
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_friends_a FOREIGN KEY (user_id_a) REFERENCES users(id),
    CONSTRAINT fk_friends_b FOREIGN KEY (user_id_b) REFERENCES users(id),
    CONSTRAINT uq_friends   UNIQUE (user_id_a, user_id_b),
    CONSTRAINT chk_canonical CHECK (user_id_a < user_id_b)
);

CREATE TABLE friend_invites (
    id          SERIAL PRIMARY KEY,
    token       VARCHAR(36)  NOT NULL UNIQUE,
    inviter_id  INT          NOT NULL,
    accepted_by INT,
    accepted    BOOLEAN      NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMP    NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_invite_inviter  FOREIGN KEY (inviter_id)  REFERENCES users(id),
    CONSTRAINT fk_invite_acceptor FOREIGN KEY (accepted_by) REFERENCES users(id)
);

CREATE INDEX idx_friend_invites_token ON friend_invites(token);
