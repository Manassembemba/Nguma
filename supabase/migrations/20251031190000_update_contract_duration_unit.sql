
-- Update the create_new_contract function to use contract_duration_months as minutes
CREATE OR REPLACE FUNCTION public.create_new_contract(investment_amount NUMERIC(20,8))
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
  result JSONB;
BEGIN
  -- 1. Get current settings
  SELECT value::NUMERIC INTO current_monthly_rate
  FROM public.settings
  WHERE key = 'monthly_profit_rate';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Monthly profit rate not set');
  END IF;

  SELECT value::INTEGER INTO contract_duration_minutes
  FROM public.settings
  WHERE key = 'contract_duration_months'; -- This setting will now be interpreted as minutes

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract duration not set');
  END IF;

  -- 2. Get user wallet and check balance
  SELECT * INTO user_wallet
  FROM public.wallets
  WHERE user_id = current_user_id;

  IF user_wallet.total_balance < investment_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- 3. Update wallet balance
  UPDATE public.wallets
  SET
    total_balance = total_balance - investment_amount,
    invested_balance = invested_balance + investment_amount,
    updated_at = now()
  WHERE user_id = current_user_id;

  -- 4. Create the new contract
  INSERT INTO public.contracts (user_id, amount, currency, monthly_rate, end_date, duration_months)
  VALUES (
    current_user_id,
    investment_amount,
    user_wallet.currency,
    current_monthly_rate,
    now() + (contract_duration_minutes || ' minutes')::interval, -- Use minutes here
    contract_duration_minutes -- Store the duration in months column, but it's minutes for testing
  )
  RETURNING id INTO new_contract_id;

  -- 5. Create investment transaction
  INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
  VALUES (
    current_user_id,
    'investment',
    investment_amount,
    user_wallet.currency,
    new_contract_id,
    'New investment contract created'
  );

  result := jsonb_build_object(
    'success', true,
    'contract_id', new_contract_id
  );

  RETURN result;
END;
$$;
