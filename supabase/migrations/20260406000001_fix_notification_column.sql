-- Quick fix: Update the functions that use wrong column name 'description' -> 'message'
-- Run this in Supabase SQL Editor

-- Fix request_deposit notification
CREATE OR REPLACE FUNCTION public.request_deposit(
  deposit_amount NUMERIC(20,8),
  deposit_method TEXT,
  p_payment_reference TEXT DEFAULT NULL,
  p_payment_phone_number TEXT DEFAULT NULL,
  p_proof_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  user_currency TEXT;
  v_transaction_id UUID;
  profile_data RECORD;
  v_deposit_enabled BOOLEAN;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_max_deposits_per_period INT;
  v_deposit_count INT;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non authentifié.');
  END IF;

  SELECT
    COALESCE((SELECT value::boolean FROM settings WHERE key = 'deposit_enabled'), TRUE),
    COALESCE((SELECT value::timestamptz FROM settings WHERE key = 'deposit_period_start'), '2024-01-01T00:00:00.000Z'::TIMESTAMPTZ),
    COALESCE((SELECT value::timestamptz FROM settings WHERE key = 'deposit_period_end'), '2099-12-31T23:59:59.999Z'::TIMESTAMPTZ),
    COALESCE((SELECT value::int FROM settings WHERE key = 'max_deposits_per_period'), 100)
  INTO
    v_deposit_enabled, v_period_start, v_period_end, v_max_deposits_per_period;

  IF NOT v_deposit_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'Les dépôts sont actuellement désactivés par l''administrateur.');
  END IF;

  IF now() NOT BETWEEN v_period_start AND v_period_end THEN
    RETURN jsonb_build_object('success', false, 'error', 'La période de dépôt est actuellement fermée.');
  END IF;

  SELECT count(*) INTO v_deposit_count
  FROM public.transactions
  WHERE user_id = current_user_id AND type = 'deposit' AND status IN ('pending', 'completed')
    AND created_at BETWEEN v_period_start AND v_period_end;

  IF v_deposit_count >= v_max_deposits_per_period THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vous avez atteint la limite de ' || v_max_deposits_per_period || ' dépôts pour la période actuelle.');
  END IF;

  IF deposit_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant du dépôt doit être positif.');
  END IF;

  SELECT * INTO profile_data FROM public.profiles WHERE id = current_user_id;
  IF profile_data.first_name IS NULL OR profile_data.last_name IS NULL OR profile_data.phone IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Veuillez compléter votre profil avant de faire un dépôt.');
  END IF;

  SELECT currency INTO user_currency FROM public.wallets WHERE user_id = current_user_id;
  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, total_balance, invested_balance, profit_balance)
    VALUES (current_user_id, 0, 0, 0) RETURNING currency INTO user_currency;
    IF user_currency IS NULL THEN user_currency := 'USD'; END IF;
  END IF;

  INSERT INTO public.transactions (user_id, type, amount, currency, status, method, description, payment_reference, payment_phone_number, proof_url)
  VALUES (current_user_id, 'deposit', deposit_amount, COALESCE(user_currency, 'USD'), 'pending', deposit_method, 'Demande de dépôt via ' || deposit_method, p_payment_reference, p_payment_phone_number, p_proof_url)
  RETURNING id INTO v_transaction_id;

  -- FIXED: use 'message' not 'description'
  INSERT INTO public.notifications (user_id, message, type, reference_id)
  VALUES (current_user_id, 'Votre demande de dépôt de ' || deposit_amount || ' USD est en attente d''approbation.', 'deposit_pending', v_transaction_id);

  PERFORM public.notify_all_admins('Nouvelle demande de dépôt de ' || deposit_amount || ' USD par ' || profile_data.email, '/admin/deposits');

  RETURN jsonb_build_object('success', true, 'message', 'Votre demande de dépôt a été créée et est en attente d''approbation.', 'transaction_id', v_transaction_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_deposit(NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;
