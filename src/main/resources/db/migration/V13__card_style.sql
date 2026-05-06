-- V13__card_style.sql
-- Add card_style column to user_preferences; default all existing rows to 'classic'
ALTER TABLE user_preferences
  ADD COLUMN card_style VARCHAR(20) NOT NULL DEFAULT 'classic';
