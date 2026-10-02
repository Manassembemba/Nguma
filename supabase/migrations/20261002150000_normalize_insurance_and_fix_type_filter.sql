-- Migration: Normalize insurance type and update filters to treat assurance/insurance as synonyms
-- Date: 2026-10-02

-- 1. Standardize all transactions to type 'insurance'
UPDATE public.transactions SET type = 'insurance' WHERE type = 'assurance';

-- 2. Update get_admin_transaction_history to treat assurance/insurance as synonyms
CREATE OR REPLACE FUNCTION public.get_admin_transaction_history(
    p_search_query TEXT DEFAULT NULL,
    p_type_filter TEXT DEFAULT 'all',
    p_status_filter TEXT DEFAULT 'all',
    p_page_num INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 10,
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_offset INTEGER;
    v_total_count INTEGER;
    v_data JSON;
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RETURN json_build_object('success', false, 'error', 'Access denied');
    END IF;

    v_offset := (p_page_num - 1) * p_page_size;

    SELECT COUNT(*)
    INTO v_total_count
    FROM public.transactions t
    JOIN public.profiles p ON t.user_id = p.id
    WHERE 
        (p_search_query IS NULL OR 
         p_search_query = '' OR
         p.email ILIKE '%' || p_search_query || '%' OR 
         (COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) ILIKE '%' || p_search_query || '%' OR
         t.id::text ILIKE '%' || p_search_query || '%')
        AND (
            p_type_filter = 'all' 
            OR (p_type_filter IN ('assurance', 'insurance') AND LOWER(t.type) IN ('assurance', 'insurance'))
            OR LOWER(t.type) = LOWER(p_type_filter)
        )
        AND (p_status_filter = 'all' OR LOWER(t.status) = LOWER(p_status_filter))
        AND (p_date_from IS NULL OR t.created_at >= p_date_from::timestamp)
        AND (p_date_to IS NULL OR t.created_at <= (p_date_to + interval '1 day')::timestamp);

    SELECT json_agg(row_to_json(t_data))
    INTO v_data
    FROM (
        SELECT 
            t.id,
            t.created_at,
            t.amount,
            t.currency,
            t.type,
            t.status,
            t.method,
            t.proof_url,
            p.email as user_email,
            (COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) as user_full_name
        FROM public.transactions t
        JOIN public.profiles p ON t.user_id = p.id
        WHERE 
            (p_search_query IS NULL OR 
             p_search_query = '' OR
             p.email ILIKE '%' || p_search_query || '%' OR 
             (COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) ILIKE '%' || p_search_query || '%' OR
             t.id::text ILIKE '%' || p_search_query || '%')
            AND (
                p_type_filter = 'all' 
                OR (p_type_filter IN ('assurance', 'insurance') AND LOWER(t.type) IN ('assurance', 'insurance'))
                OR LOWER(t.type) = LOWER(p_type_filter)
            )
            AND (p_status_filter = 'all' OR LOWER(t.status) = LOWER(p_status_filter))
            AND (p_date_from IS NULL OR t.created_at >= p_date_from::timestamp)
            AND (p_date_to IS NULL OR t.created_at <= (p_date_to + interval '1 day')::timestamp)
        ORDER BY t.created_at DESC
        LIMIT p_page_size
        OFFSET v_offset
    ) t_data;

    RETURN json_build_object(
        'data', COALESCE(v_data, '[]'::json),
        'count', v_total_count
    );
END;
$$;

-- 3. Update get_filtered_transaction_kpis to treat assurance/insurance as synonyms
CREATE OR REPLACE FUNCTION public.get_filtered_transaction_kpis(
    p_search_query TEXT DEFAULT NULL,
    p_type_filter TEXT DEFAULT 'all',
    p_status_filter TEXT DEFAULT 'all',
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    WITH filtered_txs AS (
        SELECT 
            LOWER(t.type) as type,
            LOWER(t.status) as status,
            t.amount
        FROM public.transactions t
        LEFT JOIN public.profiles p ON t.user_id = p.id
        WHERE 
            (p_search_query IS NULL OR 
             p_search_query = '' OR
             p.email ILIKE '%' || p_search_query || '%' OR 
             (COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) ILIKE '%' || p_search_query || '%' OR
             t.id::text ILIKE '%' || p_search_query || '%')
            AND (
                p_type_filter = 'all' 
                OR (p_type_filter IN ('assurance', 'insurance') AND LOWER(t.type) IN ('assurance', 'insurance'))
                OR LOWER(t.type) = LOWER(p_type_filter)
            )
            AND (p_status_filter = 'all' OR LOWER(t.status) = LOWER(p_status_filter))
            AND (p_date_from IS NULL OR t.created_at >= p_date_from::timestamp)
            AND (p_date_to IS NULL OR t.created_at <= (p_date_to + interval '1 day')::timestamp)
    )
    SELECT jsonb_build_object(
        'total_count', COUNT(*),
        'total_amount', COALESCE(SUM(amount), 0),

        -- DEPOTS
        'deposits', COALESCE(SUM(CASE 
            WHEN type = 'deposit' AND (p_status_filter <> 'all' OR status IN ('completed', 'pending')) 
            THEN amount ELSE 0 END), 0),
        'deposits_completed', COALESCE(SUM(CASE 
            WHEN type = 'deposit' AND status = 'completed' 
            THEN amount ELSE 0 END), 0),
        'deposits_pending', COALESCE(SUM(CASE 
            WHEN type = 'deposit' AND status = 'pending' 
            THEN amount ELSE 0 END), 0),
        'deposits_rejected', COALESCE(SUM(CASE 
            WHEN type = 'deposit' AND status = 'rejected' 
            THEN amount ELSE 0 END), 0),

        -- RETRAITS
        'withdrawals', COALESCE(SUM(CASE 
            WHEN type = 'withdrawal' AND (p_status_filter <> 'all' OR status IN ('completed', 'pending')) 
            THEN amount ELSE 0 END), 0),
        'withdrawals_completed', COALESCE(SUM(CASE 
            WHEN type = 'withdrawal' AND status = 'completed' 
            THEN amount ELSE 0 END), 0),
        'withdrawals_pending', COALESCE(SUM(CASE 
            WHEN type = 'withdrawal' AND status = 'pending' 
            THEN amount ELSE 0 END), 0),
        'withdrawals_rejected', COALESCE(SUM(CASE 
            WHEN type = 'withdrawal' AND status = 'rejected' 
            THEN amount ELSE 0 END), 0),

        -- TRANSFERTS
        'transfers', COALESCE(SUM(CASE 
            WHEN type = 'transfer' AND (p_status_filter <> 'all' OR status IN ('completed', 'pending')) 
            THEN amount ELSE 0 END), 0),

        -- INVESTISSEMENTS
        'investments', COALESCE(SUM(CASE 
            WHEN type = 'investment' AND (p_status_filter <> 'all' OR status IN ('completed', 'pending')) 
            THEN amount ELSE 0 END), 0),

        -- ASSURANCES
        'assurances', COALESCE(SUM(CASE 
            WHEN type IN ('assurance', 'insurance') AND (p_status_filter <> 'all' OR status IN ('completed', 'pending')) 
            THEN amount ELSE 0 END), 0)
    )
    INTO v_result
    FROM filtered_txs;

    RETURN v_result;
END;
$$;
