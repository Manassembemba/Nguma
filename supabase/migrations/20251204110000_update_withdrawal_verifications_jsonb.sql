-- Migration: Support JSONB pour les détails de paiement de retrait
-- Date: 2025-12-04
-- Description: Modifie la table withdrawal_verifications pour stocker les détails en JSONB
--              et met à jour la fonction request_withdrawal_otp correspondante.

-- 1. Modifier la table withdrawal_verifications
-- On utilise une conversion explicite pour transformer le TEXT existant en JSONB si possible, sinon objet vide
ALTER TABLE public.withdrawal_verifications
ALTER COLUMN payment_details TYPE JSONB USING 
  CASE 
    WHEN payment_details IS NULL OR payment_details = '' THEN '{}'::JSONB
    WHEN payment_details LIKE '{%}' THEN payment_details::JSONB
    ELSE jsonb_build_object('legacy_detail', payment_details)
  END;

-- 2. Mettre à jour la fonction request_withdrawal_otp
CREATE OR REPLACE FUNCTION public.request_withdrawal_otp(
    amount numeric,
    method text,
    payment_details jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_profit_balance NUMERIC(20,8);
    v_verification_id UUID;
    v_otp_code TEXT;
    v_expires_at TIMESTAMPTZ;
    profile_data record;
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    payload JSONB;
    v_min_withdrawal NUMERIC(20,8);
    v_max_withdrawal NUMERIC(20,8);
BEGIN
    -- Validation: Check if user is authenticated
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated.');
    END IF;

    -- Load withdrawal settings
    SELECT value::NUMERIC INTO v_min_withdrawal FROM public.settings WHERE key = 'min_withdrawal_amount';
    SELECT value::NUMERIC INTO v_max_withdrawal FROM public.settings WHERE key = 'max_withdrawal_amount';
    
    -- Set defaults
    v_min_withdrawal := COALESCE(v_min_withdrawal, 10);
    v_max_withdrawal := COALESCE(v_max_withdrawal, 10000);

    -- Validation: Check limits
    IF amount < v_min_withdrawal THEN
        RETURN json_build_object('success', false, 'error', 'Le montant minimum de retrait est de ' || v_min_withdrawal || ' USD.');
    END IF;

    IF amount > v_max_withdrawal THEN
        RETURN json_build_object('success', false, 'error', 'Le montant maximum de retrait est de ' || v_max_withdrawal || ' USD.');
    END IF;

    -- Get profit balance
    SELECT profit_balance INTO v_profit_balance FROM public.wallets WHERE user_id = v_user_id;
    
    IF v_profit_balance IS NULL OR v_profit_balance < amount THEN
        RETURN json_build_object('success', false, 'error', 'Solde insuffisant.');
    END IF;

    -- Generate 6-digit OTP
    v_otp_code := floor(random() * (999999 - 100000 + 1) + 100000)::text;
    v_expires_at := now() + interval '10 minutes';

    -- Create verification record
    INSERT INTO public.withdrawal_verifications (
        user_id,
        amount,
        method,
        payment_details,
        verification_code,
        expires_at
    )
    VALUES (
        v_user_id,
        amount,
        method,
        payment_details,
        v_otp_code,
        v_expires_at
    )
    RETURNING id INTO v_verification_id;

    -- Get user profile for email
    SELECT * INTO profile_data FROM public.profiles WHERE id = v_user_id;

    -- Send OTP via Email (using Edge Function)
    payload := jsonb_build_object(
        'template_id', 'withdrawal_otp',
        'to', profile_data.email,
        'name', profile_data.first_name || ' ' || profile_data.last_name,
        'otp_code', v_otp_code,
        'amount', amount,
        'expires_in', '10 minutes'
    );

    PERFORM net.http_post(
        url := project_url || '/functions/v1/send-resend-email',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := payload
    );

    RETURN json_build_object(
        'success', true, 
        'verification_id', v_verification_id,
        'message', 'Code de vérification envoyé par email.'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$$;
