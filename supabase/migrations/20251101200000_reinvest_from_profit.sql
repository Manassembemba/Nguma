
-- This function allows a user to create a new contract using their profit balance.
CREATE OR REPLACE FUNCTION public.reinvest_from_profit(reinvestment_amount NUMERIC(20,8))
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  user_wallet RECORD;
  current_monthly_rate NUMERIC(10,8);
  contract_duration_minutes INTEGER;
  new_contract_id UUID;
BEGIN
  -- 1. Get settings
  SELECT value::NUMERIC INTO current_monthly_rate FROM public.settings WHERE key = 'monthly_profit_rate';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Monthly profit rate not set'); END IF;

  SELECT value::INTEGER INTO contract_duration_minutes FROM public.settings WHERE key = 'contract_duration_months';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Contract duration not set'); END IF;

  -- 2. Get user wallet and check PROFIT balance
  SELECT * INTO user_wallet FROM public.wallets WHERE user_id = current_user_id;
  IF user_wallet.profit_balance < reinvestment_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient profit balance for reinvestment');
  END IF;

  -- 3. Update wallet balances: move funds from profit to invested
  UPDATE public.wallets
  SET
    profit_balance = profit_balance - reinvestment_amount,
    invested_balance = invested_balance + reinvestment_amount
  WHERE user_id = current_user_id;

  -- 4. Create the new contract
  INSERT INTO public.contracts (user_id, amount, currency, monthly_rate, end_date, duration_months)
  VALUES (current_user_id, reinvestment_amount, user_wallet.currency, current_monthly_rate, now() + (contract_duration_minutes || ' minutes')::interval, contract_duration_minutes)
  RETURNING id INTO new_contract_id;

  -- 5. Create reinvestment transaction
  INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
  VALUES (current_user_id, 'investment', reinvestment_amount, user_wallet.currency, new_contract_id, 'Reinvestment from profit balance');

  RETURN jsonb_build_object('success', true, 'contract_id', new_contract_id);
END;
$$;
