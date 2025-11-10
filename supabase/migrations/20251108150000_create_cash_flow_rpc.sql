CREATE OR REPLACE FUNCTION get_cash_flow_summary()
RETURNS TABLE (
    month_year TEXT,
    total_deposits NUMERIC,
    total_withdrawals NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Ensure the user is an admin before proceeding
    IF NOT is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized access: Only admins can view cash flow summaries.';
    END IF;

    RETURN QUERY
    WITH monthly_transactions AS (
        SELECT
            to_char(date_trunc('month', t.created_at), 'YYYY-MM') AS month_period,
            t.type,
            t.amount
        FROM
            transactions t
        WHERE
            t.status = 'approved' -- Only include approved transactions in cash flow
            AND t.type IN ('deposit', 'withdrawal')
            AND t.created_at >= now() - interval '12 months' -- Limit to the last 12 months
    )
    SELECT
        m.month_year,
        COALESCE(SUM(CASE WHEN mt.type = 'deposit' THEN mt.amount ELSE 0 END), 0) AS total_deposits,
        COALESCE(SUM(CASE WHEN mt.type = 'withdrawal' THEN mt.amount ELSE 0 END), 0) AS total_withdrawals
    FROM
        (
            SELECT to_char(date_trunc('month', generate_series(now() - interval '11 months', now(), '1 month')), 'YYYY-MM') as month_year
        ) m
    LEFT JOIN
        monthly_transactions mt ON m.month_year = mt.month_period
    GROUP BY
        m.month_year
    ORDER BY
        m.month_year ASC;
END;
$$;
