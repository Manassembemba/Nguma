-- Migration: Mise à jour de user_withdraw et verify_and_withdraw pour supporter JSONB
-- Date: 2025-12-04
-- Description: Met à jour user_withdraw pour accepter un objet JSONB de détails de paiement,
--              stocker ces détails dans transaction_metadata, et générer une description lisible.
--              Met à jour verify_and_withdraw pour passer l'objet JSONB.

-- 1. Mettre à jour user_withdraw
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
    v_fee_percent NUMERIC(10,4);
    v_fee_fixed NUMERIC(20,8);
    v_total_fee NUMERIC(20,8);
    v_net_amount NUMERIC(20,8);
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
    SELECT value::NUMERIC INTO v_fee_percent FROM public.settings WHERE key = 'withdrawal_fee_percent';
    SELECT value::NUMERIC INTO v_fee_fixed FROM public.settings WHERE key = 'withdrawal_fee_fixed';

    -- Set defaults if not found
    v_min_withdrawal := COALESCE(v_min_withdrawal, 10);
    v_max_withdrawal := COALESCE(v_max_withdrawal, 10000);
    v_fee_percent := COALESCE(v_fee_percent, 2);
    v_fee_fixed := COALESCE(v_fee_fixed, 1);

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

    -- Calculate fees
    v_total_fee := (withdraw_amount * v_fee_percent / 100) + v_fee_fixed;
    v_net_amount := withdraw_amount - v_total_fee;

    -- Get user profile for email
    SELECT * INTO profile_data FROM public.profiles WHERE id = v_user_id;

    -- Lock the funds (move from profit_balance to locked_balance)
    UPDATE public.wallets
    SET 
        profit_balance = profit_balance - withdraw_amount,
        locked_balance = locked_balance + withdraw_amount,
        updated_at = now()
    WHERE user_id = v_user_id;

    -- Construire une description lisible à partir des détails JSON
    -- On cherche les champs clés comme recipient_number, recipient_wallet, etc.
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

    -- Create the withdrawal transaction (pending status)
    INSERT INTO public.transactions (
        user_id, 
        amount, 
        type, 
        status, 
        method, 
        payment_reference, -- On garde NULL ou on met une valeur par défaut si besoin
        payment_phone_number, -- On essaie d'extraire le numéro si présent
        description
    )
    VALUES (
        v_user_id, 
        v_net_amount,  -- Net amount after fees
        'withdrawal', 
        'pending', 
        withdraw_method, 
        p_payment_details->>'transaction_reference', -- Si présent
        COALESCE(p_payment_details->>'recipient_number', p_payment_details->>'sender_number'),
        v_description
    )
    RETURNING id INTO new_transaction_id;

    -- Insérer les métadonnées de transaction (clé/valeur)
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
            'amount', v_net_amount,
            'details', v_recipient_info -- Ajouter les détails dans l'email si le template le supporte
        );

        PERFORM net.http_post(
            url := project_url || '/functions/v1/send-resend-email',
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := payload
        );
    END LOOP;

    -- Send in-app notification to all admins
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


-- 2. Mettre à jour verify_and_withdraw
CREATE OR REPLACE FUNCTION public.verify_and_withdraw(
    p_verification_id UUID,
    p_otp_code TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    verification_record record;
    withdrawal_result json;
BEGIN
    -- Check if user is authenticated
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated.');
    END IF;

    -- Get verification record
    SELECT * INTO verification_record
    FROM public.withdrawal_verifications
    WHERE id = p_verification_id
    AND user_id = v_user_id
    AND verified = FALSE
    AND expires_at > now();

    -- Check if verification exists and is valid
    IF verification_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Code de vérification invalide ou expiré.');
    END IF;

    -- Verify OTP code
    IF verification_record.verification_code != p_otp_code THEN
        RETURN json_build_object('success', false, 'error', 'Code de vérification incorrect.');
    END IF;

    -- Mark verification as used
    UPDATE public.withdrawal_verifications
    SET verified = TRUE
    WHERE id = p_verification_id;

    -- Process the withdrawal using the updated user_withdraw function
    -- On passe directement l'objet JSONB payment_details
    SELECT public.user_withdraw(
        verification_record.amount,
        verification_record.method,
        verification_record.payment_details -- C'est maintenant un JSONB
    ) INTO withdrawal_result;

    -- Clean up old verification codes
    PERFORM public.cleanup_expired_withdrawal_verifications();

    RETURN withdrawal_result;

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$$;
