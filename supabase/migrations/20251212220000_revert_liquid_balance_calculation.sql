-- Migration: Correction finale du calcul des soldes liquides
-- Date: 2025-12-12
-- Description: Cette migration corrige une erreur de logique introduite précédemment dans la fonction
--              `get_contract_dashboard_stats`. La colonne `total_balance` représente déjà le solde
--              liquide, donc la soustraction de `invested_balance` était incorrecte et causait
--              un résultat négatif. Cette migration restaure le calcul correct.

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
        -- Correction: On restaure le calcul correct. `total_balance` est le solde liquide.
        (SELECT COALESCE(SUM(total_balance), 0) FROM public.wallets) AS total_liquid_balance;
END;
$$;
