-- V14: Add ON DELETE CASCADE to all user-referencing FKs so that
-- deleting a user row cleanly removes all associated data in one shot.

-- ── sessions ─────────────────────────────────────────────────────────────────
ALTER TABLE sessions
    DROP CONSTRAINT sessions_user_id_fkey,
    ADD  CONSTRAINT sessions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ── friends ───────────────────────────────────────────────────────────────────
ALTER TABLE friends
    DROP CONSTRAINT fk_friends_a,
    ADD  CONSTRAINT fk_friends_a
        FOREIGN KEY (user_id_a) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE friends
    DROP CONSTRAINT fk_friends_b,
    ADD  CONSTRAINT fk_friends_b
        FOREIGN KEY (user_id_b) REFERENCES users(id) ON DELETE CASCADE;

-- ── friend_invites ────────────────────────────────────────────────────────────
ALTER TABLE friend_invites
    DROP CONSTRAINT fk_invite_inviter,
    ADD  CONSTRAINT fk_invite_inviter
        FOREIGN KEY (inviter_id)  REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE friend_invites
    DROP CONSTRAINT fk_invite_acceptor,
    ADD  CONSTRAINT fk_invite_acceptor
        FOREIGN KEY (accepted_by) REFERENCES users(id) ON DELETE SET NULL;

-- ── challenges ────────────────────────────────────────────────────────────────
-- User FKs: CASCADE so the challenge disappears if either participant is deleted
ALTER TABLE challenges
    DROP CONSTRAINT fk_challenge_challenger,
    ADD  CONSTRAINT fk_challenge_challenger
        FOREIGN KEY (challenger_user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE challenges
    DROP CONSTRAINT fk_challenge_challenged,
    ADD  CONSTRAINT fk_challenge_challenged
        FOREIGN KEY (challenged_user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Session FKs: CASCADE so deleting a session (via user cascade) removes dependent challenges
ALTER TABLE challenges
    DROP CONSTRAINT fk_challenge_ch_session,
    ADD  CONSTRAINT fk_challenge_ch_session
        FOREIGN KEY (challenger_session_id) REFERENCES sessions(id) ON DELETE CASCADE;

ALTER TABLE challenges
    DROP CONSTRAINT fk_challenge_cd_session,
    ADD  CONSTRAINT fk_challenge_cd_session
        FOREIGN KEY (challenged_session_id) REFERENCES sessions(id) ON DELETE CASCADE;

-- ── social_challenges ─────────────────────────────────────────────────────────
-- No FK existed yet; add one with CASCADE now.
ALTER TABLE social_challenges
    ADD CONSTRAINT fk_sc_creator
        FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ── social_challenge_participants ─────────────────────────────────────────────
ALTER TABLE social_challenge_participants
    ADD CONSTRAINT fk_scp_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
