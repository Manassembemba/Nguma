-- Migration: Add avatar_url to profiles table
-- Description: Adds a column to store the URL of the user's profile picture.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.profiles.avatar_url IS 'URL to the user''s profile avatar image.';
