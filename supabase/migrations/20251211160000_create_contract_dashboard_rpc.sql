-- Migration: Crée les fonctions RPC pour le tableau de bord de gestion des contrats
-- Date: 2025-12-11
-- Description: 
-- 1. `get_contract_dashboard_stats`: Fournit les statistiques générales sur les contrats.
-- 2. `get_deposit_summary`: Fournit le total des dépôts sur une période donnée.

-- Fonction 1: Statistiques générales des contrats
CREATE OR REPLACE FUNCTION public.get_contract_dashboard_stats()
RETURNS TABLE (
    active_contracts_count BIGINT,
    total_capital_invested NUMERIC,
    total_insurance_fees_collected NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Vérifier si l'utilisateur est admin
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Accès refusé. Seuls les administrateurs peuvent voir ces statistiques.';
    END IF;

    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.contracts WHERE status = 'active') AS active_contracts_count,
        (SELECT COALESCE(SUM(amount), 0) FROM public.contracts WHERE status = 'active') AS total_capital_invested,
        (SELECT COALESCE(SUM(insurance_fee_paid), 0) FROM public.contracts WHERE is_insured = TRUE) AS total_insurance_fees_collected;
END;
$$;

-- Fonction 2: Résumé des dépôts par période
CREATE OR REPLACE FUNCTION public.get_deposit_summary(
    p_date_from TEXT,
    p_date_to TEXT
)
RETURNS TABLE (
    total_deposits NUMERIC,
    deposits_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_date_from TIMESTAMPTZ;
    v_date_to TIMESTAMPTZ;
BEGIN
    -- Vérifier si l'utilisateur est admin
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Accès refusé. Seuls les administrateurs peuvent voir ces statistiques.';
    END IF;

    -- Convertir les dates textes en timestamptz, en gérant le fuseau horaire
    -- On considère que les dates en entrée sont au format YYYY-MM-DD
    v_date_from := to_timestamp(p_date_from, 'YYYY-MM-DD');
    -- Pour la date de fin, on ajoute 1 jour pour inclure toute la journée
    v_date_to := to_timestamp(p_date_to, 'YYYY-MM-DD') + interval '1 day';

    RETURN QUERY
    SELECT
        COALESCE(SUM(t.amount), 0) as total_deposits,
        COUNT(t.id) as deposits_count
    FROM public.transactions t
    WHERE t.type = 'deposit'
    AND t.status = 'completed'
    AND t.created_at >= v_date_from
    AND t.created_at < v_date_to;
END;
$$;
