
-- Add a method column to the transactions table
ALTER TABLE public.transactions
ADD COLUMN method TEXT;

-- Create a new function to request a deposit, creating a pending transaction
CREATE OR REPLACE FUNCTION public.request_deposit(deposit_amount NUMERIC(20,8), deposit_method TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  user_currency TEXT;
BEGIN
  IF deposit_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit amount must be positive');
  END IF;

  -- Get user currency from wallet
  SELECT currency INTO user_currency
  FROM public.wallets
  WHERE user_id = current_user_id;

  -- Create a pending deposit transaction
  INSERT INTO public.transactions (user_id, type, amount, currency, status, method, description)
  VALUES (
    current_user_id,
    'deposit',
    deposit_amount,
    user_currency,
    'pending', -- Set status to pending
    deposit_method,
    'User deposit request via ' || deposit_method
  );

  -- Notify admins
  PERFORM public.notify_all_admins('Nouvelle demande de dépôt de ' || deposit_amount || ' ' || user_currency, '/admin/deposits');

  RETURN jsonb_build_object('success', true, 'message', 'Deposit request created and is pending approval.');
END;
$$;
