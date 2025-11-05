
-- Function for an admin to manually credit a user's wallet
CREATE OR REPLACE FUNCTION public.admin_credit_user(target_user_id UUID, credit_amount NUMERIC(20,8), reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user_id UUID := auth.uid();
  user_wallet RECORD;
BEGIN
  -- 1. Check if the current user is an admin
  IF NOT public.has_role(admin_user_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Not an admin');
  END IF;

  -- 2. Validate amount
  IF credit_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credit amount must be positive');
  END IF;

  -- 3. Update the target user's wallet
  UPDATE public.wallets
  SET
    total_balance = total_balance + credit_amount,
    updated_at = now()
  WHERE user_id = target_user_id
  RETURNING * INTO user_wallet;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user wallet not found');
  END IF;

  -- 4. Create a deposit transaction for the credit
  INSERT INTO public.transactions (user_id, type, amount, currency, status, description)
  VALUES (
    target_user_id,
    'deposit',
    credit_amount,
    user_wallet.currency,
    'completed',
    'Admin credit: ' || reason
  );

  -- 5. Log the admin action
  INSERT INTO public.admin_actions (admin_id, action_type, target_user_id, details)
  VALUES (
    admin_user_id,
    'manual_credit',
    target_user_id,
    jsonb_build_object('amount', credit_amount, 'reason', reason)
  );

  RETURN jsonb_build_object('success', true, 'message', 'User credited successfully');
END;
$$;
