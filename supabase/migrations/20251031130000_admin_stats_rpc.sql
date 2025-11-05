
-- Function to get aggregate stats for the admin dashboard
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_investors BIGINT;
  funds_under_management NUMERIC;
  total_profit NUMERIC;
  pending_withdrawals NUMERIC;
BEGIN
  -- Check if the current user is an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Not an admin');
  END IF;

  -- Calculate stats
  SELECT count(*) INTO total_investors FROM public.profiles WHERE id IN (SELECT user_id FROM public.user_roles WHERE role = 'investor');
  SELECT COALESCE(sum(invested_balance), 0) INTO funds_under_management FROM public.wallets;
  SELECT COALESCE(sum(total_profit_paid), 0) INTO total_profit FROM public.contracts;
  SELECT COALESCE(sum(amount), 0) INTO pending_withdrawals FROM public.transactions WHERE type = 'withdrawal' AND status = 'pending';

  -- Return stats as JSON
  RETURN jsonb_build_object(
    'success', true,
    'total_investors', total_investors,
    'funds_under_management', funds_under_management,
    'total_profit', total_profit,
    'pending_withdrawals', pending_withdrawals
  );
END;
$$;
