-- Add the missing last_profit_distribution_date column to the contracts table
ALTER TABLE public.contracts
ADD COLUMN last_profit_distribution_date DATE;
