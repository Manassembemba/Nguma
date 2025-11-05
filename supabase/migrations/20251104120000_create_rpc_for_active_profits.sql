CREATE OR REPLACE FUNCTION public.get_active_contracts_profits()
RETURNS SETOF profits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.*
  FROM public.profits p
  INNER JOIN public.contracts c ON p.contract_id = c.id
  WHERE p.user_id = auth.uid()
    AND c.status = 'active'
  ORDER BY p.created_at ASC;
END;
$$;