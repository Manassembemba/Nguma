-- Migration: Fix Transaction KPIs
-- Date: 2026-10-02
-- Fixes:
--   1. type mismatch 'insurance' vs 'assurance' -> handles both
--   2. include pending transactions (not just completed)
--   3. add 'investments' KPI key (type = 'investment')

DROP FUNCTION IF EXISTS public.get_transaction_kpis(DATE, DATE);
DROP FUNCTION IF EXISTS public.get_transaction_kpis(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_transaction_kpis();

CREATE OR REPLACE FUNCTION public.get_transaction_kpis(
    p_date_from DATE DEFAULT NULL,
    p_date_to   DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today_start  TIMESTAMPTZ := date_trunc(''day'',   now() AT TIME ZONE ''UTC'');
    v_week_start   TIMESTAMPTZ := date_trunc(''week'',  now() AT TIME ZONE ''UTC'');
    v_month_start  TIMESTAMPTZ := date_trunc(''month'', now() AT TIME ZONE ''UTC'');
    v_period_start TIMESTAMPTZ;
    v_period_end   TIMESTAMPTZ;
    v_result       JSONB;
BEGIN
    IF NOT public.has_role(auth.uid(), ''admin'') THEN
        RAISE EXCEPTION ''Access denied'';
    END IF;

    v_period_start := CASE WHEN p_date_from IS NOT NULL THEN p_date_from::TIMESTAMPTZ ELSE ''-infinity''::TIMESTAMPTZ END;
    v_period_end   := CASE WHEN p_date_to   IS NOT NULL THEN (p_date_to + interval ''1 day'')::TIMESTAMPTZ ELSE ''infinity''::TIMESTAMPTZ END;

    SELECT jsonb_build_object(
        ''today'', jsonb_build_object(
            ''deposits'',             COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''deposit''    AND LOWER(status) IN (''completed'',''pending'') AND created_at >= v_today_start), 0),
            ''deposits_completed'',   COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''deposit''    AND LOWER(status) = ''completed''               AND created_at >= v_today_start), 0),
            ''withdrawals'',          COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''withdrawal'' AND LOWER(status) IN (''completed'',''pending'') AND created_at >= v_today_start), 0),
            ''withdrawals_completed'',COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''withdrawal'' AND LOWER(status) = ''completed''               AND created_at >= v_today_start), 0),
            ''transfers'',            COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''transfer''   AND LOWER(status) IN (''completed'',''pending'') AND created_at >= v_today_start), 0),
            ''investments'',          COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''investment'' AND LOWER(status) IN (''completed'',''pending'') AND created_at >= v_today_start), 0),
            ''assurances'',           COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) IN (''assurance'',''insurance'') AND LOWER(status) IN (''completed'',''pending'') AND created_at >= v_today_start), 0)
        ),
        ''week'', jsonb_build_object(
            ''deposits'',             COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''deposit''    AND LOWER(status) IN (''completed'',''pending'') AND created_at >= v_week_start), 0),
            ''deposits_completed'',   COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''deposit''    AND LOWER(status) = ''completed''               AND created_at >= v_week_start), 0),
            ''withdrawals'',          COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''withdrawal'' AND LOWER(status) IN (''completed'',''pending'') AND created_at >= v_week_start), 0),
            ''withdrawals_completed'',COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''withdrawal'' AND LOWER(status) = ''completed''               AND created_at >= v_week_start), 0),
            ''transfers'',            COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''transfer''   AND LOWER(status) IN (''completed'',''pending'') AND created_at >= v_week_start), 0),
            ''investments'',          COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''investment'' AND LOWER(status) IN (''completed'',''pending'') AND created_at >= v_week_start), 0),
            ''assurances'',           COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) IN (''assurance'',''insurance'') AND LOWER(status) IN (''completed'',''pending'') AND created_at >= v_week_start), 0)
        ),
        ''month'', jsonb_build_object(
            ''deposits'',             COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''deposit''    AND LOWER(status) IN (''completed'',''pending'') AND created_at >= v_month_start), 0),
            ''deposits_completed'',   COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''deposit''    AND LOWER(status) = ''completed''               AND created_at >= v_month_start), 0),
            ''withdrawals'',          COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''withdrawal'' AND LOWER(status) IN (''completed'',''pending'') AND created_at >= v_month_start), 0),
            ''withdrawals_completed'',COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''withdrawal'' AND LOWER(status) = ''completed''               AND created_at >= v_month_start), 0),
            ''transfers'',            COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''transfer''   AND LOWER(status) IN (''completed'',''pending'') AND created_at >= v_month_start), 0),
            ''investments'',          COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''investment'' AND LOWER(status) IN (''completed'',''pending'') AND created_at >= v_month_start), 0),
            ''assurances'',           COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) IN (''assurance'',''insurance'') AND LOWER(status) IN (''completed'',''pending'') AND created_at >= v_month_start), 0)
        ),
        ''period'', jsonb_build_object(
            ''deposits'',             COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''deposit''    AND LOWER(status) IN (''completed'',''pending'') AND created_at >= v_period_start AND created_at < v_period_end), 0),
            ''deposits_completed'',   COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''deposit''    AND LOWER(status) = ''completed''               AND created_at >= v_period_start AND created_at < v_period_end), 0),
            ''withdrawals'',          COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''withdrawal'' AND LOWER(status) IN (''completed'',''pending'') AND created_at >= v_period_start AND created_at < v_period_end), 0),
            ''withdrawals_completed'',COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''withdrawal'' AND LOWER(status) = ''completed''               AND created_at >= v_period_start AND created_at < v_period_end), 0),
            ''transfers'',            COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''transfer''   AND LOWER(status) IN (''completed'',''pending'') AND created_at >= v_period_start AND created_at < v_period_end), 0),
            ''investments'',          COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = ''investment'' AND LOWER(status) IN (''completed'',''pending'') AND created_at >= v_period_start AND created_at < v_period_end), 0),
            ''assurances'',           COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) IN (''assurance'',''insurance'') AND LOWER(status) IN (''completed'',''pending'') AND created_at >= v_period_start AND created_at < v_period_end), 0)
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_transaction_kpis(DATE, DATE) TO authenticated;
