-- Migration: Correction des fonctions de statistiques de l'administrateur
-- Date: 2025-12-12
-- Description: Cette migration corrige trois problèmes dans les fonctions d'agrégation de données pour le tableau de bord de comptabilité.
-- 1. Rend les requêtes sur les statuts des transactions insensibles à la casse (completed vs Completed).
-- 2. Corrige le calcul de la balance liquide pour refléter les fonds non investis.
-- 3. Standardise la vérification des permissions admin en utilisant `is_admin(auth.uid())` pour la cohérence.

-- 1. Recréation de get_contract_dashboard_stats
DROP FUNCTION IF EXISTS public.get_contract_dashboard_stats();
CREATE OR REPLACE FUNCTION public.get_contract_dashboard_stats()
RETURNS TABLE (
    active_contracts_count BIGINT, 
    total_capital_invested NUMERIC,
    total_insurance_fees_collected NUMERIC, 
    total_liquid_balance NUMERIC
) LANGUAGE plpgsql AS $$
BEGIN
    IF NOT is_admin(auth.uid()) THEN 
        RAISE EXCEPTION 'Accès refusé. Seuls les administrateurs peuvent accéder à ces données.';
    END IF;

    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.contracts WHERE LOWER(status) = 'active') AS active_contracts_count,
        (SELECT COALESCE(SUM(amount), 0) FROM public.contracts WHERE LOWER(status) = 'active') AS total_capital_invested,
        (SELECT COALESCE(SUM(insurance_fee_paid), 0) FROM public.contracts WHERE is_insured = TRUE) AS total_insurance_fees_collected,
        -- Correction: Calcule la somme des soldes disponibles (total - investi) de tous les utilisateurs
        (SELECT COALESCE(SUM(total_balance - invested_balance), 0) FROM public.wallets) AS total_liquid_balance;
END;
$$;

-- 2. Recréation de get_deposit_summary
DROP FUNCTION IF EXISTS public.get_deposit_summary(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.get_deposit_summary(p_date_from TEXT, p_date_to TEXT)
RETURNS TABLE (total_deposits NUMERIC, deposits_count BIGINT) LANGUAGE plpgsql AS $$
DECLARE
    v_date_from TIMESTAMPTZ := to_timestamp(p_date_from, 'YYYY-MM-DD');
    v_date_to TIMESTAMPTZ := to_timestamp(p_date_to, 'YYYY-MM-DD') + interval '1 day';
BEGIN
    IF NOT is_admin(auth.uid()) THEN 
        RAISE EXCEPTION 'Accès refusé. Seuls les administrateateurs peuvent accéder à ces données.';
    END IF;

    RETURN QUERY
    SELECT 
        COALESCE(SUM(t.amount), 0), 
        COUNT(t.id)
    FROM public.transactions t
    -- Correction: Utilise LOWER() pour être insensible à la casse
    WHERE t.type = 'deposit' AND LOWER(t.status) = 'completed' AND t.created_at >= v_date_from AND t.created_at < v_date_to;
END;
$$;

-- 3. Recréation de get_withdrawal_summary
DROP FUNCTION IF EXISTS public.get_withdrawal_summary(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.get_withdrawal_summary(p_date_from TEXT, p_date_to TEXT)
RETURNS TABLE (total_withdrawals NUMERIC, withdrawals_count BIGINT) LANGUAGE plpgsql AS $$
DECLARE
    v_date_from TIMESTAMPTZ := to_timestamp(p_date_from, 'YYYY-MM-DD');
    v_date_to TIMESTAMPTZ := to_timestamp(p_date_to, 'YYYY-MM-DD') + interval '1 day';
BEGIN
    IF NOT is_admin(auth.uid()) THEN 
        RAISE EXCEPTION 'Accès refusé. Seuls les administrateurs peuvent accéder à ces données.';
    END IF;

    RETURN QUERY
    SELECT 
        COALESCE(SUM(t.amount), 0), 
        COUNT(t.id)
    FROM public.transactions t
    -- Correction: Utilise LOWER() pour être insensible à la casse
    WHERE t.type = 'withdrawal' AND LOWER(t.status) = 'completed' AND t.created_at >= v_date_from AND t.created_at < v_date_to;
END;
$$;
