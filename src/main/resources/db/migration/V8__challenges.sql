-- DEV-159: challenges table

CREATE TABLE challenges (
    id                    SERIAL PRIMARY KEY,
    challenger_user_id    INT          NOT NULL,
    challenged_user_id    INT          NOT NULL,
    hand_id               INT          NOT NULL,
    challenger_session_id INT          NOT NULL,
    challenged_session_id INT,
    status                VARCHAR(20)  NOT NULL DEFAULT 'pending',  -- pending | accepted | completed | expired
    created_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
    completed_at          TIMESTAMP,
    CONSTRAINT fk_challenge_challenger  FOREIGN KEY (challenger_user_id)    REFERENCES users(id),
    CONSTRAINT fk_challenge_challenged  FOREIGN KEY (challenged_user_id)    REFERENCES users(id),
    CONSTRAINT fk_challenge_hand        FOREIGN KEY (hand_id)               REFERENCES hands(id),
    CONSTRAINT fk_challenge_ch_session  FOREIGN KEY (challenger_session_id) REFERENCES sessions(id),
    CONSTRAINT fk_challenge_cd_session  FOREIGN KEY (challenged_session_id) REFERENCES sessions(id),
    CONSTRAINT chk_challenge_status     CHECK (status IN ('pending','accepted','completed','expired'))
);

CREATE INDEX idx_challenges_challenged ON challenges(challenged_user_id, status);
CREATE INDEX idx_challenges_cd_session ON challenges(challenged_session_id);
