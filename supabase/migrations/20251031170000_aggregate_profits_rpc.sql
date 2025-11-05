
-- Function to get aggregate profits by month for the admin dashboard
CREATE OR REPLACE FUNCTION public.get_aggregate_profits_by_month()
RETURNS TABLE(month_year TEXT, total_profit NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the current user is an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Permission denied: Not an admin';
  END IF;

  RETURN QUERY
  SELECT
    TO_CHAR(p.created_at, 'Mon YYYY') AS month_year,
    SUM(p.amount) AS total_profit
  FROM
    public.profits p
  GROUP BY
    month_year
  ORDER BY
    MIN(p.created_at);
END;
$$;
