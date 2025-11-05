
-- Add locked_balance column to wallets table
ALTER TABLE public.wallets
ADD COLUMN locked_balance NUMERIC(20,8) NOT NULL DEFAULT 0;

-- Drop the old constraint
ALTER TABLE public.wallets
DROP CONSTRAINT positive_balances;

-- Add a new constraint that includes the new column
ALTER TABLE public.wallets
ADD CONSTRAINT positive_balances CHECK (
  total_balance >= 0 AND 
  invested_balance >= 0 AND 
  profit_balance >= 0 AND
  locked_balance >= 0
);
