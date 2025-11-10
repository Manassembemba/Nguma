-- Add the missing anniversary tracking columns to the contracts table.
-- These columns are required by the get_contracts_for_user function.
ALTER TABLE public.contracts
ADD COLUMN anniversary_day INT,
ADD COLUMN anniversary_month INT;
