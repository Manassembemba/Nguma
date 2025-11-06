-- Creates a new RPC function that can be called by a service_role (like an Edge Function)
-- to create a pending deposit for a specific user.

CREATE OR REPLACE FUNCTION public.admin_create_pending_deposit(user_id_to_credit UUID, deposit_amount NUMERIC, deposit_method TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_currency TEXT;
BEGIN
  -- Security check: Ensure this function is only callable by a service role
  IF auth.role() <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: This function is for admin services only.');
  END IF;

  IF deposit_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit amount must be positive');
  END IF;

  -- Get user currency from wallet
  SELECT currency INTO user_currency
  FROM public.wallets
  WHERE user_id = user_id_to_credit;
  
  IF NOT FOUND THEN
    user_currency := 'USD'; -- Fallback to default currency
  END IF;

  -- Create a pending deposit transaction
  INSERT INTO public.transactions (user_id, type, amount, currency, status, method, description)
  VALUES (
    user_id_to_credit,
    'deposit',
    deposit_amount,
    user_currency,
    'pending', 
    deposit_method,
    'Deposit via ' || deposit_method
  );

  -- Notify admins
  PERFORM public.notify_all_admins('Nouveau dépôt reçu via ' || deposit_method || ' de ' || deposit_amount || ' ' || user_currency, '/admin/deposits');

  RETURN jsonb_build_object('success', true, 'message', 'Pending deposit created successfully by admin service.');
END;
$$;