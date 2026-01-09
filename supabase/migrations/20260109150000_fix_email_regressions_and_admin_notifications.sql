-- Migration: Correction des régressions d'email et ajout des notifications admin
-- Date: 2026-01-09
-- Description: 
-- 1. Restaure les paramètres complets pour request_deposit (userName, transactionId, etc.)
-- 2. Intègre les notifications admin dans create_new_contract
-- 3. Ajoute les notifications admin dans reinvest_from_profit

-- ============================================================================
-- 1. CORRECTION request_deposit
-- ============================================================================
CREATE OR REPLACE FUNCTION public.request_deposit(
    deposit_amount numeric,
    deposit_method text,
    p_payment_reference text DEFAULT NULL::text,
    p_payment_phone_number text DEFAULT NULL::text,
    p_proof_url text DEFAULT NULL::text
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_user_id UUID;
    v_wallet_id UUID;
    v_transaction_id UUID;
    profile_data record;
    admin_record record;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated');
    END IF;

    IF deposit_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Le montant du dépôt doit être positif.');
    END IF;

    SELECT * INTO profile_data FROM public.profiles WHERE id = v_user_id;
    IF profile_data.first_name IS NULL OR profile_data.last_name IS NULL OR profile_data.phone IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Veuillez compléter votre profil avant de faire un dépôt.');
    END IF;

    SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_user_id;
    
    IF v_wallet_id IS NULL THEN
        INSERT INTO public.wallets (user_id, total_balance, invested_balance, profit_balance)
        VALUES (v_user_id, 0, 0, 0)
        RETURNING id INTO v_wallet_id;
    END IF;

    INSERT INTO public.transactions (
        user_id, type, amount, currency, status, method,
        payment_reference, payment_phone_number, description, proof_url
    ) VALUES (
        v_user_id, 'deposit', deposit_amount, 'USD', 'pending', deposit_method,
        p_payment_reference, p_payment_phone_number, 'Dépôt via ' || deposit_method, p_proof_url
    ) RETURNING id INTO v_transaction_id;

    -- Enqueue deposit_pending email to user
    INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
    VALUES (
        'deposit_pending',
        v_user_id,
        profile_data.email,
        jsonb_build_object(
            'to', profile_data.email,
            'name', profile_data.first_name || ' ' || profile_data.last_name,
            'amount', deposit_amount
        )
    );

    -- Enqueue notification to all admins (ENRICHED)
    FOR admin_record IN
        SELECT u.id as admin_id, u.email as admin_email FROM auth.users u
        JOIN public.user_roles ur ON u.id = ur.user_id
        WHERE ur.role = 'admin'
    LOOP
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'new_deposit_request',
            admin_record.admin_id,
            admin_record.admin_email,
            jsonb_build_object(
                'to', admin_record.admin_email,
                'amount', deposit_amount,
                'email', profile_data.email,
                'userName', profile_data.first_name || ' ' || profile_data.last_name,
                'transactionId', v_transaction_id,
                'paymentMethod', deposit_method,
                'proofUrl', p_proof_url
            )
        );
    END LOOP;

    -- Send in-app notification WITH REFERENCE ID
    PERFORM public.notify_all_admins(
        'Nouvelle demande de dépôt de ' || deposit_amount || ' USD par ' || profile_data.email,
        '/admin/deposits', 
        'admin', 
        'high',
        v_transaction_id
    );
    
    RETURN json_build_object(
        'success', true, 
        'message', 'Deposit request created successfully',
        'transaction_id', v_transaction_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- ============================================================================
-- 2. INTEGRATION DANS create_new_contract
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_new_contract(investment_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_user_id UUID := auth.uid();
  user_wallet RECORD;
  user_profile record;
  current_monthly_rate NUMERIC(10,8);
  contract_duration_months_val INTEGER;
  new_contract_id UUID;
  v_support_phone TEXT;
BEGIN
  SELECT value::NUMERIC INTO current_monthly_rate FROM public.settings WHERE key = 'monthly_profit_rate';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Monthly profit rate not set');
  END IF;

  SELECT value::INTEGER INTO contract_duration_months_val FROM public.settings WHERE key = 'contract_duration_months';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract duration not set');
  END IF;

  SELECT * INTO user_wallet FROM public.wallets WHERE user_id = current_user_id;
  IF user_wallet.total_balance < investment_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  SELECT email, first_name, last_name INTO user_profile FROM public.profiles WHERE id = current_user_id;

  UPDATE public.wallets
  SET total_balance = total_balance - investment_amount, invested_balance = invested_balance + investment_amount, updated_at = now()
  WHERE user_id = current_user_id;

  INSERT INTO public.contracts (user_id, amount, currency, monthly_rate, end_date, duration_months)
  VALUES (current_user_id, investment_amount, user_wallet.currency, current_monthly_rate, now() + (contract_duration_months_val || ' months')::interval, contract_duration_months_val)
  RETURNING id INTO new_contract_id;

  INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
  VALUES (current_user_id, 'investment', investment_amount, user_wallet.currency, new_contract_id, 'New investment contract created');

  -- Fetch Support Phone
  SELECT value INTO v_support_phone FROM public.settings WHERE key = 'support_whatsapp_number';

  -- Enqueue email notification pour l'USER
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

  -- NOTIFICATION ADMIN (NEW)
  PERFORM public.notify_admins_new_contract(
    new_contract_id,
    current_user_id,
    investment_amount,
    contract_duration_months_val,
    (current_monthly_rate * 100) -- Convert decimal 0.15 to integer 15 for template
  );

  RETURN jsonb_build_object('success', true, 'contract_id', new_contract_id);
END;
$function$;

-- ============================================================================
-- 3. INTEGRATION DANS reinvest_from_profit
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reinvest_from_profit(reinvestment_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  current_user_id UUID := auth.uid();
  user_wallet RECORD;
  user_profile record;
  current_monthly_rate NUMERIC(10,8);
  contract_duration_months_val INTEGER;
  new_contract_id UUID;
  v_support_phone TEXT;
BEGIN
  SELECT value::NUMERIC INTO current_monthly_rate FROM public.settings WHERE key = 'monthly_profit_rate';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Monthly profit rate not set');
  END IF;

  SELECT value::INTEGER INTO contract_duration_months_val FROM public.settings WHERE key = 'contract_duration_months';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract duration not set');
  END IF;

  SELECT * INTO user_wallet FROM public.wallets WHERE user_id = current_user_id;
  IF user_wallet.profit_balance < reinvestment_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient profit balance');
  END IF;

  SELECT email, first_name, last_name INTO user_profile FROM public.profiles WHERE id = current_user_id;

  UPDATE public.wallets
  SET profit_balance = profit_balance - reinvestment_amount, invested_balance = invested_balance + reinvestment_amount, updated_at = now()
  WHERE user_id = current_user_id;

  INSERT INTO public.contracts (user_id, amount, currency, monthly_rate, end_date, duration_months)
  VALUES (current_user_id, reinvestment_amount, user_wallet.currency, current_monthly_rate, now() + (contract_duration_months_val || ' months')::interval, contract_duration_months_val)
  RETURNING id INTO new_contract_id;

  INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
  VALUES (current_user_id, 'reinvestment', reinvestment_amount, user_wallet.currency, new_contract_id, 'Reinvestment from profit balance');

  -- Fetch Support Phone
  SELECT value INTO v_support_phone FROM public.settings WHERE key = 'support_whatsapp_number';

  -- Notification USER
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

  -- NOTIFICATION ADMIN (NEW)
  PERFORM public.notify_admins_new_contract(
    new_contract_id,
    current_user_id,
    reinvestment_amount,
    contract_duration_months_val,
    (current_monthly_rate * 100)
  );

  RETURN jsonb_build_object('success', true, 'contract_id', new_contract_id);
END;
$function$;
