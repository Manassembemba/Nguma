-- This migration updates the profiles table to be more detailed.
-- It replaces full_name with first_name, last_name, and post_nom, and adds birth_date and address.

ALTER TABLE public.profiles
  ADD COLUMN first_name TEXT,
  ADD COLUMN last_name TEXT,
  ADD COLUMN post_nom TEXT,
  ADD COLUMN birth_date DATE,
  ADD COLUMN address TEXT;

-- Drop the old full_name column as it is replaced by more specific fields
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS full_name;
