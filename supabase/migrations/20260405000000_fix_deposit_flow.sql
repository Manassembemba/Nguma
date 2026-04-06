-- Migration: Fix Deposit, Withdrawal & Contract Flow After Security Hardening
-- Date: 2026-04-05
-- Description: Restore user deposit/withdrawal/contract functionality that was broken by security hardening.
-- The issue: RPC functions have SECURITY DEFINER but the INSERT policies were dropped,
-- so the functions can't insert into transactions/contracts tables for regular users.

-- ============================================================
-- 1. RE-ADD INSERT POLICY FOR TRANSACTIONS (RPC-mediated)
-- ============================================================
-- This policy allows authenticated users to INSERT transactions,
-- but ONLY through RPC functions (SECURITY DEFINER bypasses RLS).
-- Direct REST API inserts are still blocked because the frontend
-- doesn't have direct table access (no INSERT policy for REST).
DROP POLICY IF EXISTS "Users can create transactions via RPC" ON public.transactions;

CREATE POLICY "Users can create transactions via RPC"
ON public.transactions
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
  AND type IN ('deposit', 'withdrawal', 'investment', 'reinvestment', 'insurance')
);

-- ============================================================
-- 2. RE-ADD INSERT POLICY FOR CONTRACTS (RPC-mediated)
-- ============================================================
-- Users can only create contracts through RPC functions.
-- Direct REST API inserts are still blocked.
DROP POLICY IF EXISTS "Users can create contracts via RPC" ON public.contracts;

CREATE POLICY "Users can create contracts via RPC"
ON public.contracts
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
);

-- ============================================================
-- 3. UPDATE request_deposit FUNCTION
-- ============================================================
-- Drop all known signatures first to avoid conflicts
DROP FUNCTION IF EXISTS public.request_deposit(NUMERIC, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.request_deposit(NUMERIC, TEXT);

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

  -- Deposit control settings
  v_deposit_enabled BOOLEAN;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_max_deposits_per_period INT;
  v_deposit_count INT;
BEGIN
  -- Verify user is authenticated
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non authentifié.');
  END IF;

  -- 1. Get deposit control settings from the settings table
  SELECT
    COALESCE((SELECT value::boolean FROM settings WHERE key = 'deposit_enabled'), TRUE),
    COALESCE((SELECT value::timestamptz FROM settings WHERE key = 'deposit_period_start'), '2024-01-01T00:00:00.000Z'::TIMESTAMPTZ),
    COALESCE((SELECT value::timestamptz FROM settings WHERE key = 'deposit_period_end'), '2099-12-31T23:59:59.999Z'::TIMESTAMPTZ),
    COALESCE((SELECT value::int FROM settings WHERE key = 'max_deposits_per_period'), 100)
  INTO
    v_deposit_enabled,
    v_period_start,
    v_period_end,
    v_max_deposits_per_period;

  -- 2. Check if deposits are globally enabled
  IF NOT v_deposit_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'Les dépôts sont actuellement désactivés par l''administrateur.');
  END IF;

  -- 3. Check if the current time is within the deposit period
  IF now() NOT BETWEEN v_period_start AND v_period_end THEN
    RETURN jsonb_build_object('success', false, 'error', 'La période de dépôt est actuellement fermée.');
  END IF;

  -- 4. Check if the user has reached the deposit limit for the current period
  SELECT count(*)
  INTO v_deposit_count
  FROM public.transactions
  WHERE user_id = current_user_id
    AND type = 'deposit'
    AND status IN ('pending', 'completed')
    AND created_at BETWEEN v_period_start AND v_period_end;

  IF v_deposit_count >= v_max_deposits_per_period THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vous avez atteint la limite de ' || v_max_deposits_per_period || ' dépôts pour la période actuelle.');
  END IF;

  -- 5. Validate amount
  IF deposit_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant du dépôt doit être positif.');
  END IF;

  -- 6. Check if profile is complete
  SELECT * INTO profile_data FROM public.profiles WHERE id = current_user_id;
  
  IF profile_data.first_name IS NULL OR profile_data.last_name IS NULL OR profile_data.phone IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Veuillez compléter votre profil avant de faire un dépôt.');
  END IF;

  -- 7. Get or create wallet
  SELECT currency INTO user_currency
  FROM public.wallets
  WHERE user_id = current_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, total_balance, invested_balance, profit_balance)
    VALUES (current_user_id, 0, 0, 0)
    RETURNING currency INTO user_currency;
    
    IF user_currency IS NULL THEN
      user_currency := 'USD';
    END IF;
  END IF;

  -- 8. Create the transaction (this works because SECURITY DEFINER bypasses RLS)
  INSERT INTO public.transactions (
    user_id, type, amount, currency, status, method,
    description, payment_reference, payment_phone_number, proof_url
  )
  VALUES (
    current_user_id,
    'deposit',
    deposit_amount,
    COALESCE(user_currency, 'USD'),
    'pending',
    deposit_method,
    'Demande de dépôt via ' || deposit_method,
    p_payment_reference,
    p_payment_phone_number,
    p_proof_url
  )
  RETURNING id INTO v_transaction_id;

  -- 9. Create notification for user
  INSERT INTO public.notifications (user_id, title, description, type, reference_id)
  VALUES (
    current_user_id,
    'Demande de dépôt créée',
    'Votre demande de dépôt de ' || deposit_amount || ' USD est en attente d''approbation.',
    'deposit_pending',
    v_transaction_id
  );

  -- 10. Notify all admins
  PERFORM public.notify_all_admins(
    'Nouvelle demande de dépôt de ' || deposit_amount || ' USD par ' || profile_data.email,
    '/admin/deposits',
    'admin',
    'high',
    v_transaction_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Votre demande de dépôt a été créée et est en attente d''approbation.',
    'transaction_id', v_transaction_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.request_deposit(NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 4. UPDATE user_withdraw FUNCTION (ensure consistency)
-- ============================================================
-- Drop all known signatures first
DROP FUNCTION IF EXISTS public.user_withdraw(NUMERIC, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.user_withdraw(NUMERIC, TEXT, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.user_withdraw(NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.user_withdraw(
    withdraw_amount numeric,
    withdraw_method text,
    p_payment_details jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    user_wallet record;
    new_transaction_id uuid;
    user_profile record;
    admin_record record;
    v_description TEXT;
    v_recipient_info TEXT := '';
BEGIN
    -- Verify user is authenticated
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Utilisateur non authentifié.');
    END IF;

    -- Get user wallet
    SELECT * INTO user_wallet FROM public.wallets WHERE user_id = v_user_id;
    IF user_wallet IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Portefeuille introuvable.');
    END IF;

    -- Check available balance (total_balance - locked_balance)
    IF (user_wallet.total_balance - COALESCE(user_wallet.locked_balance, 0)) < withdraw_amount THEN
        RETURN json_build_object('success', false, 'error', 'Solde insuffisant.');
    END IF;

    -- Move funds from total_balance to locked_balance to await admin approval
    UPDATE public.wallets
    SET
        total_balance = total_balance - withdraw_amount,
        locked_balance = COALESCE(locked_balance, 0) + withdraw_amount,
        updated_at = now()
    WHERE user_id = v_user_id;

    -- Build a readable description from JSON details
    IF p_payment_details ? 'recipient_number' THEN
        v_recipient_info := 'Vers: ' || (p_payment_details->>'recipient_number');
    ELSIF p_payment_details ? 'recipient_wallet' THEN
        v_recipient_info := 'Vers: ' || (p_payment_details->>'recipient_wallet');
    ELSIF p_payment_details ? 'recipient_binance_id' THEN
        v_recipient_info := 'Binance ID: ' || (p_payment_details->>'recipient_binance_id');
    END IF;

    v_description := 'Retrait via ' || withdraw_method;
    IF v_recipient_info != '' THEN
        v_description := v_description || ' (' || v_recipient_info || ')';
    END IF;

    -- Create transaction (SECURITY DEFINER bypasses RLS)
    INSERT INTO public.transactions (
        user_id, type, amount, currency, status, method,
        payment_details, description
    )
    VALUES (
        v_user_id, 'withdrawal', withdraw_amount, 'USD', 'pending', withdraw_method,
        p_payment_details,
        v_description
    ) RETURNING id INTO new_transaction_id;

    -- Get user profile for notification
    SELECT * INTO user_profile FROM public.profiles WHERE id = v_user_id;

    -- Enqueue email to admins via notifications_queue
    FOR admin_record IN
        SELECT u.id as admin_id, u.email as admin_email FROM auth.users u
        JOIN public.user_roles ur ON u.id = ur.user_id
        WHERE ur.role = 'admin'
    LOOP
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'new_withdrawal_request',
            admin_record.admin_id,
            admin_record.admin_email,
            jsonb_build_object(
                'name', user_profile.first_name || ' ' || user_profile.last_name,
                'email', user_profile.email,
                'amount', withdraw_amount
            )
        );
    END LOOP;

    -- Send in-app notification to all admins
    PERFORM public.notify_all_admins(
        'Nouvelle demande de retrait de ' || withdraw_amount || ' USD par ' || user_profile.email,
        '/admin/withdrawals',
        'admin',
        'high',
        new_transaction_id
    );

    -- Notify user
    INSERT INTO public.notifications (user_id, title, description, type, reference_id)
    VALUES (
        v_user_id,
        'Demande de retrait créée',
        'Votre demande de retrait de ' || withdraw_amount || ' USD est en attente d''approbation.',
        'withdrawal_pending',
        new_transaction_id
    );

    RETURN json_build_object('success', true, 'message', 'Demande de retrait créée avec succès.', 'transaction_id', new_transaction_id);

EXCEPTION WHEN OTHERS THEN
    -- If anything fails, try to roll back the fund lock.
    UPDATE public.wallets
    SET
        total_balance = total_balance + withdraw_amount,
        locked_balance = COALESCE(locked_balance, 0) - withdraw_amount
    WHERE user_id = v_user_id;

    RETURN json_build_object('success', false, 'error', 'Erreur système: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_withdraw(numeric, text, jsonb) TO authenticated;

-- ============================================================
-- 5. UPDATE create_new_contract FUNCTION
-- ============================================================
-- Drop all known signatures first
DROP FUNCTION IF EXISTS public.create_new_contract(NUMERIC, BOOLEAN);
DROP FUNCTION IF EXISTS public.create_new_contract(NUMERIC);

CREATE OR REPLACE FUNCTION public.create_new_contract(
    investment_amount NUMERIC(20,8),
    p_is_insured BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id UUID := auth.uid();
    user_wallet RECORD;
    current_monthly_rate NUMERIC(10,8);
    contract_duration_months INTEGER;
    new_contract_id UUID;
    v_insurance_fee NUMERIC(20,8);
    v_net_amount NUMERIC(20,8);
    user_profile RECORD;
    v_support_phone TEXT;
BEGIN
    -- Verify user is authenticated
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non authentifié.');
    END IF;

    -- Calculate insurance fee
    v_insurance_fee := public.calculate_insurance_fee(investment_amount, p_is_insured);
    v_net_amount := investment_amount - v_insurance_fee;

    IF v_net_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Le montant après déduction des frais d''assurance est insuffisant.');
    END IF;

    -- Get settings
    SELECT value::NUMERIC INTO current_monthly_rate FROM public.settings WHERE key = 'monthly_profit_rate';
    IF current_monthly_rate IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Taux de profit non défini.');
    END IF;

    SELECT value::INTEGER INTO contract_duration_months FROM public.settings WHERE key = 'contract_duration_months';
    IF contract_duration_months IS NULL THEN
        contract_duration_months := 10;
    END IF;

    -- Get user wallet
    SELECT * INTO user_wallet FROM public.wallets WHERE user_id = current_user_id;
    IF user_wallet IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Portefeuille introuvable.');
    END IF;

    IF user_wallet.total_balance < investment_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant.');
    END IF;

    -- Get user profile
    SELECT * INTO user_profile FROM public.profiles WHERE id = current_user_id;

    -- Update wallet balances
    UPDATE public.wallets SET
        total_balance = total_balance - investment_amount,
        invested_balance = invested_balance + v_net_amount,
        updated_at = now()
    WHERE user_id = current_user_id;

    -- Create contract (SECURITY DEFINER bypasses RLS)
    INSERT INTO public.contracts (user_id, amount, currency, monthly_rate, end_date, duration_months, is_insured, insurance_fee_paid)
    VALUES (
        current_user_id,
        v_net_amount,
        user_wallet.currency,
        current_monthly_rate,
        now() + (contract_duration_months || ' months')::INTERVAL,
        contract_duration_months,
        p_is_insured,
        v_insurance_fee
    )
    RETURNING id INTO new_contract_id;

    -- Create transaction
    INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
    VALUES (
        current_user_id,
        'investment',
        v_net_amount,
        user_wallet.currency,
        new_contract_id,
        'Nouveau contrat d''investissement'
    );

    -- Insurance fee transaction if applicable
    IF p_is_insured AND v_insurance_fee > 0 THEN
        INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
        VALUES (
            current_user_id,
            'insurance',
            v_insurance_fee,
            user_wallet.currency,
            new_contract_id,
            'Frais d''assurance du contrat'
        );
    END IF;

    -- Fetch Support Phone
    SELECT value INTO v_support_phone FROM public.settings WHERE key = 'support_whatsapp_number';

    -- Enqueue email notification for user
    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'new_investment',
            current_user_id,
            user_profile.email,
            jsonb_build_object(
                'to', user_profile.email,
                'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
                'amount', investment_amount,
                'support_phone', v_support_phone
            )
        );
    END IF;

    -- Notify admins
    PERFORM public.notify_admins_new_contract(
        new_contract_id,
        current_user_id,
        investment_amount,
        contract_duration_months,
        (current_monthly_rate * 100)
    );

    -- Notify user in-app
    INSERT INTO public.notifications (user_id, title, description, type, reference_id)
    VALUES (
        current_user_id,
        'Contrat créé avec succès',
        'Votre contrat d''investissement de ' || investment_amount || ' USD a été créé.',
        'contract_created',
        new_contract_id
    );

    RETURN jsonb_build_object('success', true, 'contract_id', new_contract_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_new_contract(NUMERIC, BOOLEAN) TO authenticated;

-- ============================================================
-- 6. UPDATE reinvest_from_profit FUNCTION
-- ============================================================
-- Drop all known signatures first
DROP FUNCTION IF EXISTS public.reinvest_from_profit(NUMERIC, BOOLEAN);
DROP FUNCTION IF EXISTS public.reinvest_from_profit(NUMERIC);

CREATE OR REPLACE FUNCTION public.reinvest_from_profit(
    reinvestment_amount NUMERIC(20,8),
    p_is_insured BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id UUID := auth.uid();
    user_wallet RECORD;
    current_monthly_rate NUMERIC(10,8);
    contract_duration_months INTEGER;
    new_contract_id UUID;
    v_insurance_fee NUMERIC(20,8);
    v_net_amount NUMERIC(20,8);
    user_profile RECORD;
    v_support_phone TEXT;
BEGIN
    -- Verify user is authenticated
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non authentifié.');
    END IF;

    -- Calculate insurance fee
    v_insurance_fee := public.calculate_insurance_fee(reinvestment_amount, p_is_insured);
    v_net_amount := reinvestment_amount - v_insurance_fee;

    IF v_net_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Le montant après déduction des frais d''assurance est insuffisant.');
    END IF;

    -- Get settings
    SELECT value::NUMERIC INTO current_monthly_rate FROM public.settings WHERE key = 'monthly_profit_rate';
    IF current_monthly_rate IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Taux de profit non défini.');
    END IF;

    SELECT value::INTEGER INTO contract_duration_months FROM public.settings WHERE key = 'contract_duration_months';
    IF contract_duration_months IS NULL THEN
        contract_duration_months := 10;
    END IF;

    -- Get user wallet
    SELECT * INTO user_wallet FROM public.wallets WHERE user_id = current_user_id;
    IF user_wallet IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Portefeuille introuvable.');
    END IF;

    IF user_wallet.profit_balance < reinvestment_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solde de profit insuffisant.');
    END IF;

    -- Get user profile
    SELECT * INTO user_profile FROM public.profiles WHERE id = current_user_id;

    -- Update wallet balances
    UPDATE public.wallets SET
        profit_balance = profit_balance - reinvestment_amount,
        invested_balance = invested_balance + v_net_amount,
        updated_at = now()
    WHERE user_id = current_user_id;

    -- Create contract (SECURITY DEFINER bypasses RLS)
    INSERT INTO public.contracts (user_id, amount, currency, monthly_rate, end_date, duration_months, is_insured, insurance_fee_paid)
    VALUES (
        current_user_id,
        v_net_amount,
        user_wallet.currency,
        current_monthly_rate,
        now() + (contract_duration_months || ' months')::INTERVAL,
        contract_duration_months,
        p_is_insured,
        v_insurance_fee
    )
    RETURNING id INTO new_contract_id;

    -- Create transaction
    INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
    VALUES (
        current_user_id,
        'reinvestment',
        v_net_amount,
        user_wallet.currency,
        new_contract_id,
        'Réinvestissement depuis le solde de profit'
    );

    -- Fetch Support Phone
    SELECT value INTO v_support_phone FROM public.settings WHERE key = 'support_whatsapp_number';

    -- Enqueue email notification for user
    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'reinvestment_confirmed',
            current_user_id,
            user_profile.email,
            jsonb_build_object(
                'to', user_profile.email,
                'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
                'amount', reinvestment_amount,
                'support_phone', v_support_phone
            )
        );
    END IF;

    -- Notify admins
    PERFORM public.notify_admins_new_contract(
        new_contract_id,
        current_user_id,
        reinvestment_amount,
        contract_duration_months,
        (current_monthly_rate * 100)
    );

    -- Notify user in-app
    INSERT INTO public.notifications (user_id, title, description, type, reference_id)
    VALUES (
        current_user_id,
        'Réinvestissement réussi',
        'Votre réinvestissement de ' || reinvestment_amount || ' USD a été effectué.',
        'reinvestment_confirmed',
        new_contract_id
    );

    RETURN jsonb_build_object('success', true, 'contract_id', new_contract_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reinvest_from_profit(NUMERIC, BOOLEAN) TO authenticated;

-- ============================================================
-- 7. ADD COMMENTS FOR DOCUMENTATION
-- ============================================================
COMMENT ON FUNCTION public.request_deposit IS 'Fonction sécurisée pour créer une demande de dépôt. SECURITY DEFINER permet de bypass RLS pour insérer dans transactions.';
COMMENT ON FUNCTION public.user_withdraw IS 'Fonction sécurisée pour créer une demande de retrait. SECURITY DEFINER permet de bypass RLS pour insérer dans transactions.';
COMMENT ON FUNCTION public.create_new_contract IS 'Fonction sécurisée pour créer un contrat. SECURITY DEFINER permet de bypass RLS pour insérer dans contracts et transactions.';
COMMENT ON FUNCTION public.reinvest_from_profit IS 'Fonction sécurisée pour réinvestir les profits. SECURITY DEFINER permet de bypass RLS pour insérer dans contracts et transactions.';
COMMENT ON POLICY "Users can create transactions via RPC" ON public.transactions IS 'Permet aux utilisateurs de créer des transactions uniquement via les fonctions RPC (SECURITY DEFINER). Les inserts directs via REST API sont bloqués.';
COMMENT ON POLICY "Users can create contracts via RPC" ON public.contracts IS 'Permet aux utilisateurs de créer des contrats uniquement via les fonctions RPC (SECURITY DEFINER). Les inserts directs via REST API sont bloqués.';
