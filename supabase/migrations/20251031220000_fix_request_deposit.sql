
-- Fix for request_deposit function to handle missing wallet currency
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

  SELECT currency INTO user_currency
  FROM public.wallets
  WHERE user_id = current_user_id;
  IF NOT FOUND THEN
    user_currency := 'USD'; -- Fallback to default currency if wallet is missing
  END IF;

  INSERT INTO public.transactions (user_id, type, amount, currency, status, method, description)
  VALUES (
    current_user_id,
    'deposit',
    deposit_amount,
    user_currency,
    'pending',
    deposit_method,
    'User deposit request via ' || deposit_method
  );

  PERFORM public.notify_all_admins('Nouvelle demande de dépôt de ' || deposit_amount || ' ' || user_currency, '/admin/deposits');

  RETURN jsonb_build_object('success', true, 'message', 'Deposit request created and is pending approval.');
END;
$$;
