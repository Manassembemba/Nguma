-- Migration: Consolidation finale et correctifs pour les modules admin et comptabilité.
-- Date: 2025-12-12
-- Description: Cette migration unique remplace toutes les migrations précédentes de la session.
--              Elle supprime les anciennes versions des fonctions et les recrée dans leur état
--              final, corrigé et optimisé. Cela garantit un état de base de données propre et cohérent.

-- 1. Suppression des versions existantes des fonctions pour éviter les conflits
DROP FUNCTION IF EXISTS public.get_investor_list_details(TEXT,INTEGER,INTEGER,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,TEXT,TEXT);
DROP FUNCTION IF EXISTS public.export_investor_list(TEXT,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,TEXT,TEXT);
DROP FUNCTION IF EXISTS public.get_contract_dashboard_stats();
DROP FUNCTION IF EXISTS public.get_upcoming_profits(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_deposit_summary(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_withdrawal_summary(TEXT, TEXT);


-- 2. Recréation de get_investor_list_details
CREATE OR REPLACE FUNCTION public.get_investor_list_details(
  p_search_query TEXT DEFAULT NULL, p_page_num INTEGER DEFAULT 1, p_page_size INTEGER DEFAULT 10,
  p_date_from TEXT DEFAULT NULL, p_date_to TEXT DEFAULT NULL, p_min_invested NUMERIC DEFAULT NULL,
  p_max_invested NUMERIC DEFAULT NULL, param_country TEXT DEFAULT NULL, param_city TEXT DEFAULT NULL,
  p_status_filter TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_offset INTEGER; v_total_count INTEGER; v_result JSONB; v_date_from DATE; v_date_to DATE;
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé.'; END IF;
  v_offset := (p_page_num - 1) * p_page_size;
  v_date_from := NULLIF(p_date_from, '')::DATE;
  v_date_to := NULLIF(p_date_to, '')::DATE;
  WITH profiles_with_status AS (
    SELECT p.*, u.banned_until, ci.total_invested, ci.contracts,
           CASE WHEN ci.contracts IS NULL OR jsonb_array_length(ci.contracts) = 0 THEN 'New'
                WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(ci.contracts) AS c WHERE LOWER(c->>'status') = 'active') THEN 'Active'
                ELSE 'Inactive'
           END as calculated_status
    FROM public.profiles p
    LEFT JOIN auth.users u ON p.id = u.id
    LEFT JOIN (
      SELECT user_id, COALESCE(SUM(amount), 0) as total_invested,
             COALESCE(jsonb_agg(jsonb_build_object('status', status)), '[]'::jsonb) as contracts
      FROM public.contracts GROUP BY user_id
    ) ci ON ci.user_id = p.id
  ),
  filtered_profiles AS (
    SELECT * FROM profiles_with_status
    WHERE (p_search_query IS NULL OR first_name ILIKE '%' || p_search_query || '%' OR last_name ILIKE '%' || p_search_query || '%' OR email ILIKE '%' || p_search_query || '%')
      AND (v_date_from IS NULL OR created_at >= v_date_from) AND (v_date_to IS NULL OR created_at < v_date_to + INTERVAL '1 day')
      AND (p_min_invested IS NULL OR COALESCE(total_invested, 0) >= p_min_invested) AND (p_max_invested IS NULL OR COALESCE(total_invested, 0) <= p_max_invested)
      AND (param_country IS NULL OR country = param_country) AND (param_city IS NULL OR city = param_city)
      AND (p_status_filter IS NULL OR calculated_status = p_status_filter)
  )
  SELECT (SELECT COUNT(*) FROM filtered_profiles), COALESCE(jsonb_agg(row_to_json(fp_paginated)), '[]'::jsonb)
  INTO v_total_count, v_result
  FROM (
    SELECT fp.id, fp.first_name, fp.last_name, fp.post_nom, fp.email, fp.phone, fp.country, fp.city,
           fp.banned_until, fp.created_at,
           (SELECT row_to_json(w) FROM public.wallets w WHERE w.user_id = fp.id) as wallet,
           fp.contracts, fp.total_invested
    FROM filtered_profiles fp
    ORDER BY fp.created_at DESC LIMIT p_page_size OFFSET v_offset
  ) AS fp_paginated;
  RETURN jsonb_build_object('count', v_total_count, 'data', v_result);
END;
$$ LANGUAGE plpgsql;

-- 3. Recréation de export_investor_list
CREATE OR REPLACE FUNCTION public.export_investor_list(
  p_search_query TEXT DEFAULT NULL, p_date_from TEXT DEFAULT NULL, p_date_to TEXT DEFAULT NULL,
  p_min_invested NUMERIC DEFAULT NULL, p_max_invested NUMERIC DEFAULT NULL, param_country TEXT DEFAULT NULL,
  param_city TEXT DEFAULT NULL, p_status_filter TEXT DEFAULT NULL
) RETURNS TABLE (
    id UUID, first_name TEXT, last_name TEXT, email TEXT, phone TEXT, total_balance NUMERIC,
    invested_balance NUMERIC, profit_balance NUMERIC, currency TEXT, status TEXT, created_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé.'; END IF;
  RETURN QUERY
  WITH user_and_contract_info AS (
    SELECT p.id, p.first_name, p.last_name, p.email, p.phone, p.created_at, w.total_balance,
           w.invested_balance, w.profit_balance, w.currency, p.country, p.city,
           COALESCE(SUM(c.amount) OVER(PARTITION BY p.id), 0) as total_invested_calc,
           CASE WHEN COUNT(c.id) = 0 THEN 'New'
                WHEN EXISTS(SELECT 1 FROM public.contracts c_active WHERE c_active.user_id = p.id AND LOWER(c_active.status) = 'active') THEN 'Active'
                ELSE 'Inactive'
           END as calculated_status
    FROM public.profiles p
    LEFT JOIN public.wallets w ON w.user_id = p.id
    LEFT JOIN public.contracts c ON c.user_id = p.id
    WHERE (p_search_query IS NULL OR p.first_name ILIKE '%' || p_search_query || '%' OR p.last_name ILIKE '%' || p_search_query || '%' OR p.email ILIKE '%' || p_search_query || '%')
      AND (p_date_from IS NULL OR p.created_at >= (p_date_from)::DATE) AND (p_date_to IS NULL OR p.created_at < (p_date_to)::DATE + INTERVAL '1 day')
      AND (param_country IS NULL OR p.country = param_country) AND (param_city IS NULL OR p.city = param_city)
    GROUP BY p.id, w.id
  )
  SELECT uci.id, uci.first_name, uci.last_name, uci.email, uci.phone, uci.total_balance,
         uci.invested_balance, uci.profit_balance, uci.currency, uci.calculated_status, uci.created_at
  FROM user_and_contract_info uci
  WHERE (p_min_invested IS NULL OR uci.total_invested_calc >= p_min_invested)
    AND (p_max_invested IS NULL OR uci.total_invested_calc <= p_max_invested)
    AND (p_status_filter IS NULL OR uci.calculated_status = p_status_filter)
  ORDER BY uci.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 4. Recréation de get_contract_dashboard_stats
CREATE OR REPLACE FUNCTION public.get_contract_dashboard_stats()
RETURNS TABLE (
    active_contracts_count BIGINT, total_capital_invested NUMERIC,
    total_insurance_fees_collected NUMERIC, total_liquid_balance NUMERIC
) LANGUAGE plpgsql AS $$
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Accès refusé.'; END IF;
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.contracts WHERE LOWER(status) = 'active') AS active_contracts_count,
        (SELECT COALESCE(SUM(amount), 0) FROM public.contracts WHERE LOWER(status) = 'active') AS total_capital_invested,
        (SELECT COALESCE(SUM(insurance_fee_paid), 0) FROM public.contracts WHERE is_insured = TRUE) AS total_insurance_fees_collected,
        (SELECT COALESCE(SUM(total_balance), 0) FROM public.wallets) AS total_liquid_balance;
END;
$$;

-- 5. Recréation de get_deposit_summary
CREATE OR REPLACE FUNCTION public.get_deposit_summary(p_date_from TEXT, p_date_to TEXT)
RETURNS TABLE (total_deposits NUMERIC, deposits_count BIGINT) LANGUAGE plpgsql AS $$
DECLARE
    v_date_from TIMESTAMPTZ := to_timestamp(p_date_from, 'YYYY-MM-DD');
    v_date_to TIMESTAMPTZ := to_timestamp(p_date_to, 'YYYY-MM-DD') + interval '1 day';
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Accès refusé.'; END IF;
    RETURN QUERY
    SELECT COALESCE(SUM(t.amount), 0), COUNT(t.id)
    FROM public.transactions t
    WHERE t.type = 'deposit' AND t.status = 'completed' AND t.created_at >= v_date_from AND t.created_at < v_date_to;
END;
$$;

-- 6. Recréation de get_withdrawal_summary
CREATE OR REPLACE FUNCTION public.get_withdrawal_summary(p_date_from TEXT, p_date_to TEXT)
RETURNS TABLE (total_withdrawals NUMERIC, withdrawals_count BIGINT) LANGUAGE plpgsql AS $$
DECLARE
    v_date_from TIMESTAMPTZ := to_timestamp(p_date_from, 'YYYY-MM-DD');
    v_date_to TIMESTAMPTZ := to_timestamp(p_date_to, 'YYYY-MM-DD') + interval '1 day';
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Accès refusé.'; END IF;
    RETURN QUERY
    SELECT COALESCE(SUM(t.amount), 0), COUNT(t.id)
    FROM public.transactions t
    WHERE t.type = 'withdrawal' AND t.status = 'completed' AND t.created_at >= v_date_from AND t.created_at < v_date_to;
END;
$$;

-- 7. Recréation de get_upcoming_profits
CREATE OR REPLACE FUNCTION public.get_upcoming_profits(
    start_date TIMESTAMPTZ DEFAULT now(), end_date TIMESTAMPTZ DEFAULT (now() + interval '7 days')
) RETURNS TABLE (
    user_id UUID, contract_id UUID, amount NUMERIC, expected_date TIMESTAMPTZ, contract_name TEXT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT c.user_id, c.id, (c.amount * c.monthly_rate), (c.start_date + (interval '1 month' * (c.months_paid + 1))), 'Contract ' || c.id::text
    FROM public.contracts c
    WHERE LOWER(c.status) = 'active'
    AND (c.start_date + (interval '1 month' * (c.months_paid + 1))) BETWEEN start_date AND end_date;
END;
$$;
