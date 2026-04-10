-- Migration: Restore complete create_new_contract function + fix notification constraints
-- Date: 2026-04-09
-- Issue: Error 23502 (not_null_violation) when creating contracts
-- Root cause: Function in DB is a truncated version that only does:
--   INSERT INTO public.contracts (user_id, amount, status) VALUES (auth.uid(), investment_amount, 'active');
-- This fails because monthly_rate is NOT NULL with no default value.
-- Solution: Restore the complete function with all required columns.

-- ============================================================
-- STEP 1: Restore complete create_new_contract function
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_new_contract(
    investment_amount NUMERIC,
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
    -- 1. Vérification authentification
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non authentifié.');
    END IF;

    -- 2. Calcul des frais d'assurance
    v_insurance_fee := public.calculate_insurance_fee(investment_amount, p_is_insured);
    v_net_amount := investment_amount - v_insurance_fee;

    IF v_net_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Le montant après déduction des frais d''assurance est insuffisant.');
    END IF;

    -- 3. Récupération des paramètres depuis settings
    SELECT value::NUMERIC INTO current_monthly_rate FROM public.settings WHERE key = 'monthly_profit_rate';
    SELECT value::INTEGER INTO contract_duration_months FROM public.settings WHERE key = 'contract_duration_months';

    IF current_monthly_rate IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Configuration manquante : monthly_profit_rate');
    END IF;

    IF contract_duration_months IS NULL THEN
        contract_duration_months := 10;
    END IF;

    -- 4. Vérification du solde
    SELECT * INTO user_wallet FROM public.wallets WHERE user_id = current_user_id;
    
    IF user_wallet IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Portefeuille introuvable.');
    END IF;

    IF user_wallet.total_balance < investment_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant.');
    END IF;

    -- 5. Récupération du profil utilisateur
    SELECT * INTO user_profile FROM public.profiles WHERE id = current_user_id;

    -- 6. Mise à jour du portefeuille
    UPDATE public.wallets SET
        total_balance = total_balance - investment_amount,
        invested_balance = invested_balance + v_net_amount,
        updated_at = now()
    WHERE user_id = current_user_id;

    -- 7. Création du contrat (TOUTES les colonnes NOT NULL incluses)
    INSERT INTO public.contracts (
        user_id, amount, currency, monthly_rate,
        duration_months, end_date, is_insured, insurance_fee_paid
    ) VALUES (
        current_user_id,
        v_net_amount,
        user_wallet.currency,
        current_monthly_rate,
        contract_duration_months,
        now() + (contract_duration_months || ' months')::INTERVAL,
        p_is_insured,
        v_insurance_fee
    ) RETURNING id INTO new_contract_id;

    -- 8. Enregistrement de la transaction d'investissement
    INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
    VALUES (
        current_user_id,
        'investment',
        v_net_amount,
        user_wallet.currency,
        new_contract_id,
        'Nouveau contrat d''investissement'
    );

    -- 9. Transaction frais d'assurance si applicable
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

    -- 10. Récupérer le numéro de support
    SELECT value INTO v_support_phone FROM public.settings WHERE key = 'support_whatsapp_number';

    -- 11. Notification email à l'utilisateur
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

    -- 12. Notification aux admins
    PERFORM public.notify_admins_new_contract(
        new_contract_id,
        current_user_id,
        investment_amount,
        contract_duration_months,
        (current_monthly_rate * 100)
    );

    -- 13. Notification in-app à l'utilisateur
    INSERT INTO public.notifications (user_id, message, type, reference_id)
    VALUES (
        current_user_id,
        'Votre contrat d''investissement de ' || investment_amount || ' USD a été créé.',
        'contract_created',
        new_contract_id
    );

    RETURN jsonb_build_object('success', true, 'contract_id', new_contract_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Re-grant execute permission
GRANT EXECUTE ON FUNCTION public.create_new_contract(NUMERIC, BOOLEAN) TO authenticated;

-- ============================================================
-- STEP 2: Fix notification type constraint (safety)
-- ============================================================

ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
    'transaction', 'system', 'contract', 'profit', 'admin',
    'wallet_update', 'info', 'warning', 'success', 'error',
    'contract_created', 'contract_completed', 'contract_refunded',
    'deposit_pending', 'deposit_approved', 'deposit_rejected',
    'withdrawal_pending', 'withdrawal_approved', 'withdrawal_rejected',
    'investment', 'insurance', 'security_alert', 'maintenance',
    'admin_message', 'support_response'
));

COMMENT ON COLUMN public.notifications.type IS 
    'Type de notification. Voir notifications_type_check pour les valeurs autorisées.';

-- ============================================================
-- STEP 3: Fix notification priority constraint (safety)
-- ============================================================

ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_priority_check;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_priority_check 
CHECK (priority IN ('low', 'medium', 'high', 'critical', 'urgent'));

COMMENT ON COLUMN public.notifications.priority IS 
    'Priorité de notification: low, medium, high, critical, urgent';

-- ============================================================
-- STEP 4: Verification
-- ============================================================

DO $$
DECLARE
    v_function_exists BOOLEAN;
    v_constraint_type TEXT;
    v_constraint_priority TEXT;
BEGIN
    -- Verify function exists with correct signature
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'create_new_contract'
          AND p.pronargs = 2
    ) INTO v_function_exists;

    -- Verify constraints
    SELECT pg_get_constraintdef(oid) INTO v_constraint_type
    FROM pg_constraint WHERE conrelid = 'public.notifications'::regclass AND conname = 'notifications_type_check';

    SELECT pg_get_constraintdef(oid) INTO v_constraint_priority
    FROM pg_constraint WHERE conrelid = 'public.notifications'::regclass AND conname = 'notifications_priority_check';

    IF NOT v_function_exists THEN
        RAISE EXCEPTION 'FUNCTION create_new_contract was NOT restored correctly!';
    END IF;

    IF v_constraint_type IS NULL THEN
        RAISE WARNING 'Constraint notifications_type_check was NOT created (column may not exist)';
    END IF;

    IF v_constraint_priority IS NULL THEN
        RAISE WARNING 'Constraint notifications_priority_check was NOT created (column may not exist)';
    END IF;

    RAISE NOTICE '✅ Migration applied successfully!';
    RAISE NOTICE '   - Function create_new_contract restored with all required columns';
    RAISE NOTICE '   - notifications_type_check constraint: %', COALESCE(v_constraint_type, 'N/A');
    RAISE NOTICE '   - notifications_priority_check constraint: %', COALESCE(v_constraint_priority, 'N/A');
END $$;
