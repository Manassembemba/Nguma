CREATE OR REPLACE FUNCTION get_contracts_for_user(p_user_id TEXT)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    amount NUMERIC,
    profit_rate REAL,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    duration_months INT,
    status TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    last_profit_distribution_date DATE,
    anniversary_day INT,
    anniversary_month INT,
    contract_pdf_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if the caller is an admin
    IF NOT is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Accès non autorisé. Seuls les administrateurs peuvent voir les contrats des autres utilisateurs.';
    END IF;

    RETURN QUERY
    SELECT
        c.id,
        c.user_id,
        c.amount,
        c.profit_rate,
        c.start_date,
        c.end_date,
        c.duration_months,
        c.status,
        c.created_at,
        c.updated_at,
        c.last_profit_distribution_date,
        c.anniversary_day,
        c.anniversary_month,
        c.contract_pdf_url
    FROM
        contracts c
    WHERE
        c.user_id = p_user_id
    ORDER BY
        c.created_at DESC;
END;
$$;
