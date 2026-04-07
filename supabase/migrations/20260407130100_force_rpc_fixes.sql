-- Migration: Force RPC Fixes (get_pending_withdrawals_with_profiles, user_withdraw, request_deposit)
-- Date: 2026-04-07 13:01

-- 1. CORRECTION : Liste des retraits (Fix undefined_column post_nom)
CREATE OR REPLACE FUNCTION public.get_pending_withdrawals_with_profiles()
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'AccÃ¨s refusÃ©.';
    END IF;

    RETURN QUERY
    SELECT
        jsonb_build_object(
            'id', t.id,
            'user_id', t.user_id,
            'amount', t.amount,
            'currency', t.currency,
            'status', t.status,
            'method', t.method,
            'payment_reference', t.payment_reference,
            'payment_phone_number', t.payment_phone_number,
            'payment_details', t.metadata,
            'description', t.description,
            'created_at', t.created_at,
            'updated_at', t.updated_at,
            'profile', jsonb_build_object(
                'email', p.email,
                'full_name', trim(concat_ws(' ', p.first_name, p.post_nom, p.last_name)),
                'phone', p.phone
            )
        )
    FROM
        public.transactions t
    JOIN
        public.profiles p ON t.user_id = p.id
    WHERE
        t.type = 'withdrawal' AND t.status = 'pending'
    ORDER BY
        t.created_at ASC;
END;
$$;

-- 2. CORRECTION : Processus de Retrait (DÃ©tails & Metadata)
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
    new_transaction_id uuid;
    v_profile record;
    admin_record record;
    v_recipient_info TEXT := '';
    v_description TEXT;
    field_key TEXT;
    field_value TEXT;
BEGIN
    UPDATE public.wallets SET 
        profit_balance = profit_balance - withdraw_amount,
        locked_balance = COALESCE(locked_balance, 0) + withdraw_amount
    WHERE user_id = v_user_id AND profit_balance >= withdraw_amount;

    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Solde insuffisant.'); END IF;

    -- Extraction du bÃ©nÃ©ficiaire
    IF p_payment_details ? 'recipient_wallet' THEN v_recipient_info := p_payment_details->>'recipient_wallet';
    ELSIF p_payment_details ? 'recipient_number' THEN v_recipient_info := p_payment_details->>'recipient_number';
    ELSE v_recipient_info := COALESCE(p_payment_details->>'recipient_name', p_payment_details->>'account_name', 'DÃ©tails non fournis');
    END IF;

    v_description := 'Retrait ' || withdraw_method || ' (' || v_recipient_info || ')';
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

    v_user_name := COALESCE(trim(concat_ws(' ', v_profile.first_name, v_profile.last_name)), 'Utilisateur');

    INSERT INTO public.transactions (user_id, type, amount, status, method, metadata, description, currency)
    VALUES (v_user_id, 'withdrawal', withdraw_amount, 'pending', withdraw_method, p_payment_details, v_description, 'USD')
    RETURNING id INTO new_transaction_id;

    -- Migration des mÃ©tadonnÃ©es pour l'Admin UI
    IF p_payment_details IS NOT NULL AND p_payment_details != '{}'::jsonb THEN
        FOR field_key, field_value IN SELECT * FROM jsonb_each_text(p_payment_details) LOOP
            INSERT INTO public.transaction_metadata (transaction_id, field_key, field_value)
            VALUES (new_transaction_id, field_key, field_value) ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    -- Notifications Admin
    FOR admin_record IN SELECT ur.user_id, p.email FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id WHERE ur.role = 'admin' LOOP
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES ('new_withdrawal_request', admin_record.user_id, admin_record.email, 
            jsonb_build_object(
                'amount', withdraw_amount, 
                'email', v_profile.email, 
                'userName', v_user_name,
                'withdrawalMethod', withdraw_method,
                'recipientName', v_recipient_info, 
                'transactionId', new_transaction_id
            ));
    END LOOP;

    RETURN json_build_object('success', true, 'transaction_id', new_transaction_id);
END;
$$;

-- 3. CORRECTION : DÃ©pÃ´t (Fix variable admin_record)
CREATE OR REPLACE FUNCTION public.request_deposit(
    deposit_amount numeric,
    deposit_method text,
    p_payment_reference text DEFAULT NULL::text,
    p_payment_phone_number text DEFAULT NULL::text,
    p_proof_url text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  new_transaction_id UUID;
  v_profile RECORD;
  v_user_name TEXT;
  admin_record RECORD;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    v_user_name := COALESCE(trim(concat_ws(' ', v_profile.first_name, v_profile.post_nom, v_profile.last_name)), 'Utilisateur');

    -- Insert into transactions correctly
    INSERT INTO public.transactions (user_id, type, amount, status, method, proof_url, payment_reference, payment_phone_number, currency)
    VALUES (v_user_id, 'deposit', deposit_amount, 'pending', deposit_method, p_proof_url, p_payment_reference, p_payment_phone_number, 'USD')
    RETURNING id INTO new_transaction_id;

    -- Send notifications
    FOR admin_record IN SELECT ur.user_id, p.email FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id WHERE ur.role = 'admin' LOOP
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES ('new_deposit_request', admin_record.user_id, admin_record.email, 
            jsonb_build_object(
                'amount', deposit_amount, 
                'email', v_profile.email, 
                'userName', v_user_name,
                'paymentMethod', deposit_method,
                'transactionId', new_transaction_id
            ));
    END LOOP;

  RETURN jsonb_build_object('success', true, 'transaction_id', new_transaction_id);
END;
$$;

-- 4. CORRECTION : Approbation Dépôt (Ajout Email Utilisateur)
CREATE OR REPLACE FUNCTION public.approve_deposit(transaction_id_to_approve uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    transaction_record record;
    user_profile record;
    v_support_phone text;
BEGIN
    SELECT * INTO transaction_record FROM public.transactions WHERE id = transaction_id_to_approve AND status = 'pending';
    IF transaction_record IS NULL THEN RETURN json_build_object('success', false, 'error', 'Transaction non trouvée'); END IF;

    UPDATE public.wallets SET total_balance = total_balance + transaction_record.amount WHERE user_id = transaction_record.user_id;
    UPDATE public.transactions SET status = 'completed', updated_at = now() WHERE id = transaction_id_to_approve;

    -- Notifier In-App
    INSERT INTO public.notifications (user_id, message, type, reference_id, priority)
    VALUES (transaction_record.user_id, 'Votre dépôt de ' || transaction_record.amount || ' USD a été approuvé.', 'transaction', transaction_id_to_approve, 'high');

    -- Notifier Par Email
    SELECT email, first_name, last_name INTO user_profile FROM public.profiles WHERE id = transaction_record.user_id;
    SELECT value INTO v_support_phone FROM public.settings WHERE key = 'support_whatsapp_number';
    
    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES ('deposit_approved', transaction_record.user_id, user_profile.email, jsonb_build_object(
            'name', COALESCE(trim(concat_ws(' ', user_profile.first_name, user_profile.last_name)), 'Investisseur'),
            'amount', transaction_record.amount,
            'support_phone', v_support_phone
        ));
    END IF;

    -- LOG ADMIN
    PERFORM public.log_admin_action_to_emails('Approbation de Dépôt', transaction_record.user_id, transaction_record.amount, 'Validation Dépôt');

    RETURN json_build_object('success', true);
END;
$function$;

-- 4. CORRECTION SUPPLÉMENTAIRE : Ajout de l'accusé de réception (User Pending) pour les dépôts et retraits.
CREATE OR REPLACE FUNCTION public.request_deposit(deposit_amount numeric, deposit_method text, p_payment_reference text DEFAULT NULL::text, p_payment_phone_number text DEFAULT NULL::text, p_proof_url text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  new_transaction_id UUID;
  v_profile RECORD;
  v_user_name TEXT;
  admin_record RECORD;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    v_user_name := COALESCE(trim(concat_ws(' ', v_profile.first_name, v_profile.post_nom, v_profile.last_name)), 'Investisseur');

    -- Insert into transactions correctly
    INSERT INTO public.transactions (user_id, type, amount, status, method, proof_url, payment_reference, payment_phone_number, currency)
    VALUES (v_user_id, 'deposit', deposit_amount, 'pending', deposit_method, p_proof_url, p_payment_reference, p_payment_phone_number, 'USD')
    RETURNING id INTO new_transaction_id;

    -- Send notifications to User
    IF v_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES ('deposit_pending', v_user_id, v_profile.email, 
            jsonb_build_object(
                'amount', deposit_amount, 
                'name', v_user_name
            ));
    END IF;

    -- Send notifications to Admins
    FOR admin_record IN SELECT ur.user_id, p.email FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id WHERE ur.role = 'admin' LOOP
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES ('new_deposit_request', admin_record.user_id, admin_record.email, 
            jsonb_build_object(
                'amount', deposit_amount, 
                'email', v_profile.email, 
                'userName', v_user_name,
                'paymentMethod', deposit_method,
                'transactionId', new_transaction_id
            ));
    END LOOP;

  RETURN jsonb_build_object('success', true, 'transaction_id', new_transaction_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.user_withdraw(withdraw_amount numeric, withdraw_method text, p_payment_details jsonb DEFAULT '{}'::jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    new_transaction_id uuid;
    v_profile record;
    admin_record record;
    v_recipient_info TEXT := '';
    v_description TEXT;
    field_key TEXT;
    field_value TEXT;
    v_user_name TEXT;
BEGIN
    UPDATE public.wallets SET 
        profit_balance = profit_balance - withdraw_amount,
        locked_balance = COALESCE(locked_balance, 0) + withdraw_amount
    WHERE user_id = v_user_id AND profit_balance >= withdraw_amount;

    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Solde insuffisant.'); END IF;

    IF p_payment_details ? 'recipient_wallet' THEN v_recipient_info := p_payment_details->>'recipient_wallet';
    ELSIF p_payment_details ? 'recipient_number' THEN v_recipient_info := p_payment_details->>'recipient_number';
    ELSE v_recipient_info := COALESCE(p_payment_details->>'recipient_name', p_payment_details->>'account_name', 'Détails non fournis');
    END IF;

    v_description := 'Retrait ' || withdraw_method || ' (' || v_recipient_info || ')';
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    
    v_user_name := COALESCE(trim(concat_ws(' ', v_profile.first_name, v_profile.last_name)), 'Investisseur');

    INSERT INTO public.transactions (user_id, type, amount, status, method, metadata, description, currency)
    VALUES (v_user_id, 'withdrawal', withdraw_amount, 'pending', withdraw_method, p_payment_details, v_description, 'USD')
    RETURNING id INTO new_transaction_id;

    IF p_payment_details IS NOT NULL AND p_payment_details != '{}'::jsonb THEN
        FOR field_key, field_value IN SELECT * FROM jsonb_each_text(p_payment_details) LOOP
            INSERT INTO public.transaction_metadata (transaction_id, field_key, field_value)
            VALUES (new_transaction_id, field_key, field_value) ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    -- Notifier Utilisateur
    IF v_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES ('withdrawal_pending', v_user_id, v_profile.email, 
            jsonb_build_object(
                'amount', withdraw_amount, 
                'name', v_user_name
            ));
    END IF;

    -- Notifier Admins
    FOR admin_record IN SELECT ur.user_id, p.email FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id WHERE ur.role = 'admin' LOOP
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES ('new_withdrawal_request', admin_record.user_id, admin_record.email, 
            jsonb_build_object(
                'amount', withdraw_amount, 
                'email', v_profile.email, 
                'userName', v_user_name,
                'withdrawalMethod', withdraw_method,
                'recipientName', v_recipient_info, 
                'transactionId', new_transaction_id
            ));
    END LOOP;

    RETURN json_build_object('success', true, 'transaction_id', new_transaction_id);
END;
$function$;
