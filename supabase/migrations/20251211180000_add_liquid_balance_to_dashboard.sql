-- Migration: Ajoute le solde total non investi au RPC du tableau de bord des contrats
-- Date: 2025-12-11
-- Description: 
-- Met à jour la fonction `get_contract_dashboard_stats` pour inclure la somme de tous les
-- `total_balance` des portefeuilles utilisateurs. Cet indicateur représente le capital
-- liquide total détenu par les clients mais non encore investi dans des contrats.

DROP FUNCTION IF EXISTS public.get_contract_dashboard_stats();

CREATE OR REPLACE FUNCTION public.get_contract_dashboard_stats()
RETURNS TABLE (
    active_contracts_count BIGINT,
    total_capital_invested NUMERIC,
    total_insurance_fees_collected NUMERIC,
    total_liquid_balance NUMERIC -- NOUVELLE COLONNE
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
        (SELECT COALESCE(SUM(insurance_fee_paid), 0) FROM public.contracts WHERE is_insured = TRUE) AS total_insurance_fees_collected,
        (SELECT COALESCE(SUM(total_balance), 0) FROM public.wallets) AS total_liquid_balance; -- NOUVEAU CALCUL
END;
$$;
