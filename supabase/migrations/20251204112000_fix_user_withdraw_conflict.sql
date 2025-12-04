-- Migration: Nettoyage complet des fonctions user_withdraw en conflit
-- Date: 2025-12-04
-- Description: Supprime de force toutes les versions de user_withdraw existantes
--              puis recrée uniquement la version JSONB correcte

-- ÉTAPE 1: Supprimer CASCADE toutes les fonctions user_withdraw existantes
-- Cela supprimera toutes les signatures, peu importe le nombre de paramètres
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT proname, oidvectortypes(proargtypes) as argtypes
        FROM pg_proc 
        WHERE proname = 'user_withdraw' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS public.user_withdraw(%s) CASCADE', r.argtypes);
        RAISE NOTICE 'Dropped function: user_withdraw(%)', r.argtypes;
    END LOOP;
END$$;

-- ÉTAPE 2: Recréer la fonction avec la signature JSONB correcte
CREATE FUNCTION public.user_withdraw(
    withdraw_amount numeric,
    withdraw_method text DEFAULT 'crypto'::text,
    p_payment_details jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_profit_balance NUMERIC(20,8);
    profile_data record;
    admin_record record;
    new_transaction_id UUID;
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    payload JSONB;
    v_min_withdrawal NUMERIC(20,8);
    v_max_withdrawal NUMERIC(20,8);
    v_fee_percent NUMERIC(10,4);
    v_fee_fixed NUMERIC(20,8);
    v_total_fee NUMERIC(20,8);
    v_net_amount NUMERIC(20,8);
    v_description TEXT;
    v_key TEXT;
    v_value TEXT;
    v_recipient_info TEXT := '';
BEGIN
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated.');
    END IF;

    SELECT value::NUMERIC INTO v_min_withdrawal FROM public.settings WHERE key = 'min_withdrawal_amount';
    SELECT value::NUMERIC INTO v_max_withdrawal FROM public.settings WHERE key = 'max_withdrawal_amount';
    SELECT value::NUMERIC INTO v_fee_percent FROM public.settings WHERE key = 'withdrawal_fee_percent';
    SELECT value::NUMERIC INTO v_fee_fixed FROM public.settings WHERE key = 'withdrawal_fee_fixed';

    v_min_withdrawal := COALESCE(v_min_withdrawal, 10);
    v_max_withdrawal := COALESCE(v_max_withdrawal, 10000);
    v_fee_percent := COALESCE(v_fee_percent, 2);
    v_fee_fixed := COALESCE(v_fee_fixed, 1);

    IF withdraw_amount < v_min_withdrawal THEN
        RETURN json_build_object('success', false, 'error', 'Le montant minimum de retrait est de ' || v_min_withdrawal || ' USD.');
    END IF;

    IF withdraw_amount > v_max_withdrawal THEN
        RETURN json_build_object('success', false, 'error', 'Le montant maximum de retrait est de ' || v_max_withdrawal || ' USD.');
    END IF;

    SELECT profit_balance INTO v_profit_balance FROM public.wallets WHERE user_id = v_user_id;
    IF v_profit_balance IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Wallet not found for user.');
    END IF;

    IF v_profit_balance < withdraw_amount THEN
        RETURN json_build_object('success', false, 'error', 'Solde de profits insuffisant pour ce retrait.');
    END IF;

    v_total_fee := (withdraw_amount * v_fee_percent / 100) + v_fee_fixed;
    v_net_amount := withdraw_amount - v_total_fee;

    SELECT * INTO profile_data FROM public.profiles WHERE id = v_user_id;

    UPDATE public.wallets
    SET 
        profit_balance = profit_balance - withdraw_amount,
        locked_balance = locked_balance + withdraw_amount,
        updated_at = now()
    WHERE user_id = v_user_id;

    IF p_payment_details ? 'recipient_number' THEN
        v_recipient_info := 'Vers: ' || (p_payment_details->>'recipient_number');
    ELSIF p_payment_details ? 'recipient_wallet' THEN
        v_recipient_info := 'Vers: ' || (p_payment_details->>'recipient_wallet');
    ELSIF p_payment_details ? 'recipient_account' THEN
        v_recipient_info := 'Vers: ' || (p_payment_details->>'recipient_account');
    ELSIF p_payment_details ? 'recipient_binance_id' THEN
        v_recipient_info := 'Binance ID: ' || (p_payment_details->>'recipient_binance_id');
    END IF;

    v_description := 'Retrait via ' || withdraw_method;
    IF v_recipient_info != '' THEN
        v_description := v_description || ' (' || v_recipient_info || ')';
    END IF;
    
    IF v_total_fee > 0 THEN
        v_description := v_description || ' (Frais: ' || v_total_fee::TEXT || ' USD)';
    END IF;

    INSERT INTO public.transactions (
        user_id, amount, type, status, method, 
        payment_reference, payment_phone_number, description
    )
    VALUES (
        v_user_id, v_net_amount, 'withdrawal', 'pending', withdraw_method, 
        p_payment_details->>'transaction_reference',
        COALESCE(p_payment_details->>'recipient_number', p_payment_details->>'sender_number'),
        v_description
    )
    RETURNING id INTO new_transaction_id;

    IF p_payment_details IS NOT NULL THEN
        FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_payment_details)
        LOOP
            INSERT INTO public.transaction_metadata (transaction_id, field_key, field_value)
            VALUES (new_transaction_id, v_key, v_value);
        END LOOP;
    END IF;

    FOR admin_record IN
        SELECT u.email FROM auth.users u
        JOIN public.user_roles ur ON u.id = ur.user_id
        WHERE ur.role = 'admin'
    LOOP
        payload := jsonb_build_object(
            'template_id', 'new_withdrawal_request',
            'to', admin_record.email,
            'name', profile_data.first_name || ' ' || profile_data.last_name,
            'email', profile_data.email,
            'amount', v_net_amount,
            'details', v_recipient_info
        );

        PERFORM net.http_post(
            url := project_url || '/functions/v1/send-resend-email',
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := payload
        );
    END LOOP;

    PERFORM public.notify_all_admins(
        'Nouvelle demande de retrait de ' || v_net_amount || ' USD par ' || profile_data.email || '. ' || v_recipient_info,
        '/admin/withdrawals',
        'admin',
        'high'
    );

    RETURN json_build_object('success', true, 'transaction_id', new_transaction_id, 'net_amount', v_net_amount, 'fee', v_total_fee);

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_withdraw(numeric, text, jsonb) TO authenticated;
COMMENT ON FUNCTION public.user_withdraw IS 'Processes withdrawal with JSONB payment details and stores metadata';
