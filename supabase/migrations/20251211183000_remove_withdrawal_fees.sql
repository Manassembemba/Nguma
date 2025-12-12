-- Migration: Supprime les frais de retrait et corrige le bug de calcul
-- Date: 2025-12-11
-- Description: 
-- 1. Met à jour la fonction `user_withdraw` pour supprimer toute la logique de calcul des frais.
-- 2. Le montant de la transaction est maintenant le montant brut, ce qui corrige le bug
--    où les frais restaient coincés dans le `locked_balance`.

CREATE OR REPLACE FUNCTION public.user_withdraw(
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
    v_description TEXT;
    v_key TEXT;
    v_value TEXT;
    v_recipient_info TEXT := '';
BEGIN
    -- Validation: Check if user is authenticated
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated.');
    END IF;

    -- Load withdrawal settings
    SELECT value::NUMERIC INTO v_min_withdrawal FROM public.settings WHERE key = 'min_withdrawal_amount';
    SELECT value::NUMERIC INTO v_max_withdrawal FROM public.settings WHERE key = 'max_withdrawal_amount';

    -- Set defaults if not found
    v_min_withdrawal := COALESCE(v_min_withdrawal, 10);
    v_max_withdrawal := COALESCE(v_max_withdrawal, 10000);

    -- Validation: Check minimum withdrawal
    IF withdraw_amount < v_min_withdrawal THEN
        RETURN json_build_object('success', false, 'error', 'Le montant minimum de retrait est de ' || v_min_withdrawal || ' USD.');
    END IF;

    -- Validation: Check maximum withdrawal
    IF withdraw_amount > v_max_withdrawal THEN
        RETURN json_build_object('success', false, 'error', 'Le montant maximum de retrait est de ' || v_max_withdrawal || ' USD.');
    END IF;

    -- Get profit balance
    SELECT profit_balance INTO v_profit_balance FROM public.wallets WHERE user_id = v_user_id;
    IF v_profit_balance IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Wallet not found for user.');
    END IF;

    -- Check if profit balance is sufficient
    IF v_profit_balance < withdraw_amount THEN
        RETURN json_build_object('success', false, 'error', 'Solde de profits insuffisant pour ce retrait.');
    END IF;

    -- Get user profile for email
    SELECT * INTO profile_data FROM public.profiles WHERE id = v_user_id;

    -- Lock the funds (move from profit_balance to locked_balance)
    UPDATE public.wallets
    SET 
        profit_balance = profit_balance - withdraw_amount,
        locked_balance = locked_balance + withdraw_amount,
        updated_at = now()
    WHERE user_id = v_user_id;

    -- Build description from JSON details
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
    
    -- Create the withdrawal transaction (pending status) with the GROSS amount
    INSERT INTO public.transactions (
        user_id, 
        amount, 
        type, 
        status, 
        method, 
        payment_reference,
        payment_phone_number,
        description
    )
    VALUES (
        v_user_id, 
        withdraw_amount,  -- Use the gross amount, as there are no fees
        'withdrawal', 
        'pending', 
        withdraw_method, 
        p_payment_details->>'transaction_reference',
        COALESCE(p_payment_details->>'recipient_number', p_payment_details->>'sender_number'),
        v_description
    )
    RETURNING id INTO new_transaction_id;

    -- Insert transaction metadata
    IF p_payment_details IS NOT NULL THEN
        FOR v_key, v_value IN
            SELECT * FROM jsonb_each_text(p_payment_details)
        LOOP
            INSERT INTO public.transaction_metadata (transaction_id, field_key, field_value)
            VALUES (new_transaction_id, v_key, v_value);
        END LOOP;
    END IF;

    -- Notify admins via email
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
            'amount', withdraw_amount, -- Gross amount
            'details', v_recipient_info
        );

        PERFORM net.http_post(
            url := project_url || '/functions/v1/send-resend-email',
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := payload
        );
    END LOOP;

    -- Send in-app notification to all admins
    PERFORM public.notify_all_admins(
        'Nouvelle demande de retrait de ' || withdraw_amount || ' USD par ' || profile_data.email || '. ' || v_recipient_info,
        '/admin/withdrawals',
        'admin',
        'high'
    );

    RETURN json_build_object('success', true, 'transaction_id', new_transaction_id, 'net_amount', withdraw_amount, 'fee', 0);

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$$;
