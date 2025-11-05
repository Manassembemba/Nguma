
-- Function to handle a user deposit
CREATE OR REPLACE FUNCTION public.user_deposit(deposit_amount NUMERIC(20,8))
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  user_wallet RECORD;
BEGIN
  IF deposit_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit amount must be positive');
  END IF;

  -- Update wallet balance
  UPDATE public.wallets
  SET
    total_balance = total_balance + deposit_amount,
    updated_at = now()
  WHERE user_id = current_user_id
  RETURNING * INTO user_wallet;

  -- Create deposit transaction
  INSERT INTO public.transactions (user_id, type, amount, currency, status, description)
  VALUES (
    current_user_id,
    'deposit',
    deposit_amount,
    user_wallet.currency,
    'completed',
    'User deposit'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to handle a user withdrawal from profit balance
CREATE OR REPLACE FUNCTION public.user_withdraw(withdraw_amount NUMERIC(20,8))
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  user_wallet RECORD;
BEGIN
  IF withdraw_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal amount must be positive');
  END IF;

  -- Get user wallet and check profit balance
  SELECT * INTO user_wallet
  FROM public.wallets
  WHERE user_id = current_user_id;

  IF user_wallet.profit_balance < withdraw_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient profit balance');
  END IF;

  -- Update wallet balances
  UPDATE public.wallets
  SET
    total_balance = total_balance - withdraw_amount,
    profit_balance = profit_balance - withdraw_amount,
    updated_at = now()
  WHERE user_id = current_user_id;

  -- Create withdrawal transaction
  INSERT INTO public.transactions (user_id, type, amount, currency, status, description)
  VALUES (
    current_user_id,
    'withdrawal',
    withdraw_amount,
    user_wallet.currency,
    'completed',
    'Withdrawal from profits'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;
