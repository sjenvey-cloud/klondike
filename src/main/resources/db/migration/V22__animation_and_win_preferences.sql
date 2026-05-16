-- DEV-225: animation speed and win animation preferences
ALTER TABLE user_preferences
    ADD COLUMN animation_speed VARCHAR(10)  NOT NULL DEFAULT 'normal',
    ADD COLUMN win_animation   VARCHAR(20)  NOT NULL DEFAULT 'confetti';
