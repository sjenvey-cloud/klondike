-- DEV-228: avatar URL on users table
ALTER TABLE users
    ADD COLUMN avatar_url VARCHAR(500) NULL;
