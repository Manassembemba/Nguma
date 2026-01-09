-- Migration: Secure Admin Actions Notifications
-- Date: 2026-01-09
-- Description: 
-- 1. Updates admin_credit_user to enqueue notification.
-- 2. Updates admin_activate_user to enqueue notification.
-- 3. Updates admin_deactivate_user to enqueue notification.

-- 1. admin_credit_user
CREATE OR REPLACE FUNCTION public.admin_credit_user(target_user_id UUID, credit_amount NUMERIC(20,8), reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_user RECORD;
  v_wallet RECORD;
  v_transaction_id UUID;
BEGIN
  -- Verification Admin
  IF NOT public.has_role(v_admin_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- Get User and Wallet
  SELECT first_name, last_name, email INTO v_user FROM public.profiles WHERE id = target_user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé'); END IF;

  UPDATE public.wallets SET total_balance = total_balance + credit_amount, updated_at = now()
  WHERE user_id = target_user_id RETURNING * INTO v_wallet;

  -- Transaction
  INSERT INTO public.transactions (user_id, type, amount, currency, status, description)
  VALUES (target_user_id, 'deposit', credit_amount, v_wallet.currency, 'completed', 'Crédit admin: ' || reason)
  RETURNING id INTO v_transaction_id;

  -- Notification Queue
  INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
  VALUES (
    'admin_manual_credit',
    target_user_id,
    v_user.email,
    jsonb_build_object(
      'name', COALESCE(v_user.first_name || ' ' || v_user.last_name, 'Investisseur'),
      'amount', credit_amount,
      'reason', reason
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. admin_deactivate_user
CREATE OR REPLACE FUNCTION public.admin_deactivate_user(user_id_to_deactivate UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
    END IF;

    SELECT first_name, last_name, email INTO v_user FROM public.profiles WHERE id = user_id_to_deactivate;

    UPDATE public.profiles SET banned_until = '9999-12-31'::TIMESTAMPTZ WHERE id = user_id_to_deactivate;

    INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
    VALUES ('account_suspended', user_id_to_deactivate, v_user.email, jsonb_build_object(
        'name', COALESCE(v_user.first_name || ' ' || v_user.last_name, 'Investisseur'),
        'reason', 'Action administrative'
    ));

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. admin_activate_user
CREATE OR REPLACE FUNCTION public.admin_activate_user(user_id_to_activate UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
    END IF;

    SELECT first_name, last_name, email INTO v_user FROM public.profiles WHERE id = user_id_to_activate;

    UPDATE public.profiles SET banned_until = NULL WHERE id = user_id_to_activate;

    INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
    VALUES ('account_reactivated', user_id_to_activate, v_user.email, jsonb_build_object(
        'name', COALESCE(v_user.first_name || ' ' || v_user.last_name, 'Investisseur')
    ));

    RETURN jsonb_build_object('success', true);
END;
$$;
