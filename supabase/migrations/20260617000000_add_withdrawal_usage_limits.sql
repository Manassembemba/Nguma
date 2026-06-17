-- Migration to add configurable withdrawal limits (daily amount, weekly count, monthly count)
-- Date: 2026-06-17

-- 1. Add the new settings
INSERT INTO public.settings (key, value, type, label, description, category)
VALUES 
('withdrawal_daily_limit_amount', '1000', 'number', 'Limite quotidienne (Montant)', 'Montant total maximum de retrait par jour par utilisateur', 'security'),
('withdrawal_weekly_limit_count', '3', 'number', 'Limite hebdomadaire (Nombre)', 'Nombre maximum de retraits autorisés par semaine', 'security'),
('withdrawal_monthly_limit_count', '5', 'number', 'Limite mensuelle (Nombre)', 'Nombre maximum de retraits autorisés par mois', 'security')
ON CONFLICT (key) DO UPDATE SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- 2. Update request_withdrawal_otp function to enforce these limits
CREATE OR REPLACE FUNCTION public.request_withdrawal_otp(
    p_amount NUMERIC,
    p_method TEXT,
    p_payment_details JSONB
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_otp_code TEXT;
    v_verification_id UUID;
    v_profit_balance NUMERIC(20,8);
    v_min_withdrawal NUMERIC(20,8);
    v_max_withdrawal NUMERIC(20,8);
    
    -- New limit variables
    v_daily_limit_amount NUMERIC(20,8);
    v_weekly_limit_count INTEGER;
    v_monthly_limit_count INTEGER;
    
    v_today_total NUMERIC(20,8);
    v_weekly_count INTEGER;
    v_monthly_count INTEGER;
    
    profile_data record;
    v_recent_requests INTEGER;
    v_otp_enabled_setting TEXT;
BEGIN
    -- Check if user is authenticated
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated.');
    END IF;

    -- 1. Rate limiting: Max 3 OTP requests per hour (prevent spam)
    SELECT COUNT(*) INTO v_recent_requests
    FROM public.withdrawal_verifications
    WHERE user_id = v_user_id
    AND created_at > now() - INTERVAL '1 hour';

    IF v_recent_requests >= 3 THEN
        RETURN json_build_object('success', false, 'error', 'Trop de demandes de code. Veuillez patienter avant de réessayer.');
    END IF;

    -- 2. Load withdrawal settings
    SELECT value::NUMERIC INTO v_min_withdrawal FROM public.settings WHERE key = 'min_withdrawal_amount';
    SELECT value::NUMERIC INTO v_max_withdrawal FROM public.settings WHERE key = 'max_withdrawal_amount';
    
    SELECT value::NUMERIC INTO v_daily_limit_amount FROM public.settings WHERE key = 'withdrawal_daily_limit_amount';
    SELECT value::INTEGER INTO v_weekly_limit_count FROM public.settings WHERE key = 'withdrawal_weekly_limit_count';
    SELECT value::INTEGER INTO v_monthly_limit_count FROM public.settings WHERE key = 'withdrawal_monthly_limit_count';
    
    v_min_withdrawal := COALESCE(v_min_withdrawal, 10);
    v_max_withdrawal := COALESCE(v_max_withdrawal, 10000);
    v_daily_limit_amount := COALESCE(v_daily_limit_amount, 1000);
    v_weekly_limit_count := COALESCE(v_weekly_limit_count, 3);
    v_monthly_limit_count := COALESCE(v_monthly_limit_count, 5);

    -- 3. Validate individual transaction amount limits
    IF p_amount < v_min_withdrawal THEN
        RETURN json_build_object('success', false, 'error', 'Le montant minimum de retrait est de ' || v_min_withdrawal || ' USD.');
    END IF;

    IF p_amount > v_max_withdrawal THEN
        RETURN json_build_object('success', false, 'error', 'Le montant maximum de retrait est de ' || v_max_withdrawal || ' USD.');
    END IF;

    -- 4. Enforce Usage Limits (Daily, Weekly, Monthly)
    
    -- Daily amount limit check
    SELECT COALESCE(SUM(amount), 0) INTO v_today_total
    FROM public.transactions
    WHERE user_id = v_user_id
    AND type = 'withdrawal'
    AND status IN ('pending', 'approved', 'completed')
    AND created_at >= date_trunc('day', now());

    IF (v_today_total + p_amount) > v_daily_limit_amount THEN
        RETURN json_build_object('success', false, 'error', 'Limite quotidienne de retrait atteinte. Vous avez déjà retiré ' || v_today_total || ' USD aujourd''hui (Max: ' || v_daily_limit_amount || ' USD).');
    END IF;

    -- Weekly count limit check
    SELECT COUNT(*) INTO v_weekly_count
    FROM public.transactions
    WHERE user_id = v_user_id
    AND type = 'withdrawal'
    AND status IN ('pending', 'approved', 'completed')
    AND created_at >= date_trunc('week', now());

    IF v_weekly_count >= v_weekly_limit_count THEN
        RETURN json_build_object('success', false, 'error', 'Limite hebdomadaire de retrait atteinte (Max ' || v_weekly_limit_count || ' retraits par semaine).');
    END IF;

    -- Monthly count limit check
    SELECT COUNT(*) INTO v_monthly_count
    FROM public.transactions
    WHERE user_id = v_user_id
    AND type = 'withdrawal'
    AND status IN ('pending', 'approved', 'completed')
    AND created_at >= date_trunc('month', now());

    IF v_monthly_count >= v_monthly_limit_count THEN
        RETURN json_build_object('success', false, 'error', 'Limite mensuelle de retrait atteinte (Max ' || v_monthly_limit_count || ' retraits par mois).');
    END IF;

    -- 5. Check current profit balance
    SELECT profit_balance INTO v_profit_balance FROM public.wallets WHERE user_id = v_user_id;
    IF v_profit_balance IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Wallet not found.');
    END IF;

    IF v_profit_balance < p_amount THEN
        RETURN json_build_object('success', false, 'error', 'Solde de profits insuffisant.');
    END IF;

    -- 6. Check if OTP is enabled
    SELECT value INTO v_otp_enabled_setting FROM public.settings WHERE key = 'withdrawal_otp_enabled';
    v_otp_enabled_setting := COALESCE(v_otp_enabled_setting, 'true');

    -- Get user profile for notification
    SELECT * INTO profile_data FROM public.profiles WHERE id = v_user_id;

    IF v_otp_enabled_setting = 'true' THEN
        -- Generate 6-digit OTP code
        v_otp_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

        -- Store verification code
        INSERT INTO public.withdrawal_verifications (
            user_id,
            verification_code,
            amount,
            method,
            payment_details,
            verified
        )
        VALUES (
            v_user_id,
            v_otp_code,
            p_amount,
            p_method,
            p_payment_details,
            FALSE
        )
        RETURNING id INTO v_verification_id;

        -- Enqueue the OTP email
        IF profile_data.email IS NOT NULL THEN
            INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
            VALUES (
                'withdrawal_otp',
                v_user_id,
                profile_data.email,
                jsonb_build_object(
                    'name', profile_data.first_name || ' ' || profile_data.last_name,
                    'otp_code', v_otp_code,
                    'amount', p_amount
                )
            );
        END IF;

        RETURN json_build_object(
            'success', true, 
            'verification_id', v_verification_id,
            'message', 'Code de vérification envoyé par email.'
        );
    ELSE
        -- OTP is disabled, bypass verification
        v_otp_code := 'BYPASSED_ADMIN';

        INSERT INTO public.withdrawal_verifications (
            user_id,
            verification_code,
            amount,
            method,
            payment_details,
            verified
        )
        VALUES (
            v_user_id,
            v_otp_code,
            p_amount,
            p_method,
            p_payment_details,
            TRUE
        )
        RETURNING id INTO v_verification_id;

        RETURN json_build_object(
            'success', true, 
            'verification_id', v_verification_id,
            'message', 'OTP verification bypassed by admin setting.'
        );
    END IF;

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$$;
