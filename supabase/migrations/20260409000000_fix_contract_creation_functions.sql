-- Correction des fonctions de création de contrat et réinvestissement
-- Ces fonctions restaurent la logique complète incluant le taux de profit et la durée depuis les paramètres (settings)

-- ==========================================
-- 1. FIX create_new_contract
-- ==========================================
DROP FUNCTION IF EXISTS public.create_new_contract(NUMERIC, BOOLEAN);

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
    -- Vérification de l'authentification
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non authentifié.');
    END IF;

    -- Calcul des frais d'assurance via la fonction dédiée
    v_insurance_fee := public.calculate_insurance_fee(investment_amount, p_is_insured);
    v_net_amount := investment_amount - v_insurance_fee;

    IF v_net_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Le montant après déduction des frais d''assurance est insuffisant.');
    END IF;

    -- Récupération du taux de profit
    SELECT value::NUMERIC INTO current_monthly_rate FROM public.settings WHERE key = 'monthly_profit_rate';
    IF current_monthly_rate IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Taux de profit (monthly_profit_rate) non défini dans les paramètres.');
    END IF;

    -- Récupération de la durée du contrat
    SELECT value::INTEGER INTO contract_duration_months FROM public.settings WHERE key = 'contract_duration_months';
    IF contract_duration_months IS NULL THEN
        contract_duration_months := 10; -- Valeur par défaut
    END IF;

    -- Vérification du portefeuille
    SELECT * INTO user_wallet FROM public.wallets WHERE user_id = current_user_id;
    IF user_wallet IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Portefeuille introuvable.');
    END IF;

    IF user_wallet.total_balance < investment_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant (Total Balance).');
    END IF;

    -- Récupération du profil pour l'email
    SELECT * INTO user_profile FROM public.profiles WHERE id = current_user_id;

    -- MISE À JOUR DU PORTEFEUILLE
    UPDATE public.wallets SET
        total_balance = total_balance - investment_amount,
        invested_balance = invested_balance + v_net_amount,
        updated_at = now()
    WHERE user_id = current_user_id;

    -- CRÉATION DU CONTRAT
    INSERT INTO public.contracts (
        user_id, 
        amount, 
        currency, 
        monthly_rate, 
        end_date, 
        duration_months, 
        is_insured, 
        insurance_fee_paid
    )
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

    -- CRÉATION DE LA TRANSACTION PRINCIPALE
    INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description, status)
    VALUES (
        current_user_id,
        'investment',
        v_net_amount,
        user_wallet.currency,
        new_contract_id,
        'Nouveau contrat d''investissement',
        'completed'
    );

    -- Transaction pour les frais d'assurance si applicable
    IF p_is_insured AND v_insurance_fee > 0 THEN
        INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description, status)
        VALUES (
            current_user_id,
            'insurance',
            v_insurance_fee,
            user_wallet.currency,
            new_contract_id,
            'Frais d''assurance du contrat',
            'completed'
        );
    END IF;

    -- Notification Admin
    PERFORM public.notify_admins_new_contract(
        new_contract_id,
        current_user_id,
        investment_amount,
        contract_duration_months,
        current_monthly_rate
    );

    RETURN jsonb_build_object('success', true, 'contract_id', new_contract_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ==========================================
-- 2. FIX reinvest_from_profit
-- ==========================================
DROP FUNCTION IF EXISTS public.reinvest_from_profit(NUMERIC, BOOLEAN);

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
BEGIN
    -- Vérification de l'authentification
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non authentifié.');
    END IF;

    -- Calcul des frais d'assurance
    v_insurance_fee := public.calculate_insurance_fee(reinvestment_amount, p_is_insured);
    v_net_amount := reinvestment_amount - v_insurance_fee;

    IF v_net_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Le montant après déduction des frais d''assurance est insuffisant.');
    END IF;

    -- Récupération du taux et de la durée
    SELECT value::NUMERIC INTO current_monthly_rate FROM public.settings WHERE key = 'monthly_profit_rate';
    SELECT value::INTEGER INTO contract_duration_months FROM public.settings WHERE key = 'contract_duration_months';
    
    IF current_monthly_rate IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Taux de profit non défini.');
    END IF;

    -- Vérification du solde de profit
    SELECT * INTO user_wallet FROM public.wallets WHERE user_id = current_user_id;
    IF user_wallet.profit_balance < reinvestment_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solde de profit insuffisant.');
    END IF;

    -- MISE À JOUR DU PORTEFEUILLE
    UPDATE public.wallets SET
        profit_balance = profit_balance - reinvestment_amount,
        invested_balance = invested_balance + v_net_amount,
        updated_at = now()
    WHERE user_id = current_user_id;

    -- CRÉATION DU CONTRAT
    INSERT INTO public.contracts (
        user_id, amount, currency, monthly_rate, 
        end_date, duration_months, is_insured, insurance_fee_paid
    )
    VALUES (
        current_user_id,
        v_net_amount,
        user_wallet.currency,
        current_monthly_rate,
        now() + (COALESCE(contract_duration_months, 10) || ' months')::INTERVAL,
        COALESCE(contract_duration_months, 10),
        p_is_insured,
        v_insurance_fee
    )
    RETURNING id INTO new_contract_id;

    -- CRÉATION DE LA TRANSACTION
    INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description, status)
    VALUES (
        current_user_id,
        'reinvestment',
        v_net_amount,
        user_wallet.currency,
        new_contract_id,
        'Réinvestissement depuis le solde de profit',
        'completed'
    );

    -- Notification Admin
    PERFORM public.notify_admins_new_contract(
        new_contract_id, 
        current_user_id, 
        reinvestment_amount, 
        COALESCE(contract_duration_months, 10), 
        current_monthly_rate
    );

    RETURN jsonb_build_object('success', true, 'contract_id', new_contract_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Attribution des permissions
GRANT EXECUTE ON FUNCTION public.create_new_contract(NUMERIC, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reinvest_from_profit(NUMERIC, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.create_new_contract IS 'Version corrigée : gère les frais d''assurance et récupère les taux depuis settings.';
COMMENT ON FUNCTION public.reinvest_from_profit IS 'Version corrigée : permet de réinvestir les profits avec gestion d''assurance.';
