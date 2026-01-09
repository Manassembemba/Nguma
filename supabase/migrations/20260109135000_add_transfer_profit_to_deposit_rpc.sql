-- Function to transfer funds from profit balance to total (deposit) balance
CREATE OR REPLACE FUNCTION public.transfer_profit_to_deposit(p_amount NUMERIC(20,8))
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_wallet RECORD;
BEGIN
  -- 1. Get user wallet and check PROFIT balance
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_user_id;
  
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF v_wallet.profit_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde de profit insuffisant');
  END IF;

  -- 2. Update wallet balances: move funds from profit to total balance (available for deposit/investment)
  UPDATE public.wallets
  SET
    profit_balance = profit_balance - p_amount,
    total_balance = total_balance + p_amount
  WHERE user_id = v_user_id;

  -- 3. Create transfer transaction
  INSERT INTO public.transactions (
    user_id, 
    type, 
    amount, 
    currency, 
    status,
    description,
    metadata
  )
  VALUES (
    v_user_id, 
    'transfer', 
    p_amount, 
    v_wallet.currency, 
    'completed',
    'Transfert du solde de profit vers le capital déposable (Capitalisation)',
    jsonb_build_object('from', 'profit_balance', 'to', 'total_balance')
  );

  -- 4. Create notification
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    v_user_id, 
    'Transfert Réussi', 
    'Vous avez transféré ' || p_amount || ' ' || v_wallet.currency || ' de vos profits vers votre balance de dépôt.',
    'wallet_update'
  );

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
