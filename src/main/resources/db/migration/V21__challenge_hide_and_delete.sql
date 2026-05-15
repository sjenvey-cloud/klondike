-- Allow cascade-delete of participants when a challenge is deleted by its creator.
ALTER TABLE social_challenge_participants
    DROP CONSTRAINT social_challenge_participants_challenge_id_fkey,
    ADD  CONSTRAINT social_challenge_participants_challenge_id_fkey
        FOREIGN KEY (challenge_id) REFERENCES social_challenges(id) ON DELETE CASCADE;

-- Participants can hide a challenge from their own list without affecting other users.
ALTER TABLE social_challenge_participants
    ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT FALSE;
