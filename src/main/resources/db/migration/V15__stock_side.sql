-- DEV: Draw pile (stock) side preference — 'left' (default) or 'right'
ALTER TABLE user_preferences
    ADD COLUMN stock_side VARCHAR(5) NOT NULL DEFAULT 'left';
