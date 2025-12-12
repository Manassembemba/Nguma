-- Migration: Ajoute un RPC pour le résumé des retraits par période
-- Date: 2025-12-11
-- Description: 
-- Crée la fonction `get_withdrawal_summary` pour calculer le montant total et le nombre
-- de retraits complétés sur une plage de dates donnée.

CREATE OR REPLACE FUNCTION public.get_withdrawal_summary(
    p_date_from TEXT,
    p_date_to TEXT
)
RETURNS TABLE (
    total_withdrawals NUMERIC,
    withdrawals_count BIGINT
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
    v_date_from := to_timestamp(p_date_from, 'YYYY-MM-DD');
    v_date_to := to_timestamp(p_date_to, 'YYYY-MM-DD') + interval '1 day';

    RETURN QUERY
    SELECT
        COALESCE(SUM(t.amount), 0) as total_withdrawals,
        COUNT(t.id) as withdrawals_count
    FROM public.transactions t
    WHERE t.type = 'withdrawal'
    AND t.status = 'completed'
    AND t.created_at >= v_date_from
    AND t.created_at < v_date_to;
END;
$$;
