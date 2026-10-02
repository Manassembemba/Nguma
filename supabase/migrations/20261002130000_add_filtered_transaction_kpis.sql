-- Migration: Add Filtered Transaction KPIs Function
-- Date: 2026-10-02
-- Description: Dynamically calculates KPIs matching active filters, excluding rejected by default

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
            AND (p_type_filter = 'all' OR t.type = p_type_filter)
            AND (p_status_filter = 'all' OR t.status = p_status_filter)
            AND (p_date_from IS NULL OR t.created_at >= p_date_from::timestamp)
            AND (p_date_to IS NULL OR t.created_at <= (p_date_to + interval '1 day')::timestamp)
    )
    SELECT jsonb_build_object(
        'total_count', COUNT(*),
        'total_amount', COALESCE(SUM(amount), 0),

        -- DEPOTS: rejetés exclus par défaut quand filtre = 'all'
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

        -- RETRAITS: rejetés exclus par défaut quand filtre = 'all'
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

GRANT EXECUTE ON FUNCTION public.get_filtered_transaction_kpis(TEXT, TEXT, TEXT, DATE, DATE) TO authenticated;
