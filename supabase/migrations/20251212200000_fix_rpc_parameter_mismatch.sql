-- Migration: Correction finale des fonctions de statistiques suite aux erreurs de logs
-- Date: 2025-12-12
-- Description: Cette migration corrige les erreurs d'appel RPC (404 et 400) remontées par les logs Supabase.
-- 1. Corrige l'incohérence des noms de paramètres pour `get_deposit_summary` et `get_withdrawal_summary`.
-- 2. Corrige le nommage ambigu des paramètres dans `get_upcoming_profits`.

-- 1. Recréation de get_deposit_summary avec les bons noms de paramètres
DROP FUNCTION IF EXISTS public.get_deposit_summary(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.get_deposit_summary(
    -- Correction: Les noms correspondent maintenant à l'appel RPC côté client
    start_date TEXT, 
    end_date TEXT
)
RETURNS TABLE (total_deposits NUMERIC, deposits_count BIGINT) LANGUAGE plpgsql AS $$
DECLARE
    v_date_from TIMESTAMPTZ := to_timestamp(start_date, 'YYYY-MM-DD');
    v_date_to TIMESTAMPTZ := to_timestamp(end_date, 'YYYY-MM-DD') + interval '1 day';
BEGIN
    IF NOT is_admin(auth.uid()) THEN 
        RAISE EXCEPTION 'Accès refusé.';
    END IF;

    RETURN QUERY
    SELECT 
        COALESCE(SUM(t.amount), 0), 
        COUNT(t.id)
    FROM public.transactions t
    WHERE t.type = 'deposit' AND LOWER(t.status) = 'completed' AND t.created_at >= v_date_from AND t.created_at < v_date_to;
END;
$$;

-- 2. Recréation de get_withdrawal_summary avec les bons noms de paramètres
DROP FUNCTION IF EXISTS public.get_withdrawal_summary(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.get_withdrawal_summary(
    -- Correction: Les noms correspondent maintenant à l'appel RPC côté client
    start_date TEXT, 
    end_date TEXT
)
RETURNS TABLE (total_withdrawals NUMERIC, withdrawals_count BIGINT) LANGUAGE plpgsql AS $$
DECLARE
    v_date_from TIMESTAMPTZ := to_timestamp(start_date, 'YYYY-MM-DD');
    v_date_to TIMESTAMPTZ := to_timestamp(end_date, 'YYYY-MM-DD') + interval '1 day';
BEGIN
    IF NOT is_admin(auth.uid()) THEN 
        RAISE EXCEPTION 'Accès refusé.';
    END IF;

    RETURN QUERY
    SELECT 
        COALESCE(SUM(t.amount), 0), 
        COUNT(t.id)
    FROM public.transactions t
    WHERE t.type = 'withdrawal' AND LOWER(t.status) = 'completed' AND t.created_at >= v_date_from AND t.created_at < v_date_to;
END;
$$;

-- 3. Recréation de get_upcoming_profits pour résoudre l'ambiguïté
DROP FUNCTION IF EXISTS public.get_upcoming_profits(TIMESTAMPTZ, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION public.get_upcoming_profits(
    -- Correction: Renommage pour éviter la collision avec la colonne contracts.start_date
    p_start_date TIMESTAMPTZ DEFAULT now(), 
    p_end_date TIMESTAMPTZ DEFAULT (now() + interval '7 days')
) 
RETURNS TABLE (
    user_id UUID, contract_id UUID, amount NUMERIC, expected_date TIMESTAMPTZ, contract_name TEXT
) LANGUAGE plpgsql AS $$
BEGIN
    IF NOT is_admin(auth.uid()) THEN 
        RAISE EXCEPTION 'Accès refusé.';
    END IF;

    RETURN QUERY
    SELECT c.user_id, c.id, (c.amount * c.monthly_rate), (c.start_date + (interval '1 month' * (c.months_paid + 1))), 'Contract ' || c.id::text
    FROM public.contracts c
    WHERE LOWER(c.status) = 'active'
    -- Correction: Utilisation des paramètres préfixés pour éviter l'ambiguïté
    AND (c.start_date + (interval '1 month' * (c.months_paid + 1))) BETWEEN p_start_date AND p_end_date;
END;
$$;
