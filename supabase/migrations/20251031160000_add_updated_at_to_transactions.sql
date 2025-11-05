
-- Add updated_at column to transactions table
ALTER TABLE public.transactions
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

-- Create a generic trigger function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to the transactions table
CREATE TRIGGER on_transactions_update
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
