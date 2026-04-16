-- V10: daily_challenges table
-- Maps each (date, draw_mode) to a specific hand, enabling curated
-- daily selections from previously-played hands.
CREATE TABLE daily_challenges (
    id           SERIAL PRIMARY KEY,
    challenge_date DATE         NOT NULL,
    draw_mode      VARCHAR(10)  NOT NULL,
    hand_id        INT          NOT NULL REFERENCES hands(id),
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_daily_challenge UNIQUE (challenge_date, draw_mode)
);
