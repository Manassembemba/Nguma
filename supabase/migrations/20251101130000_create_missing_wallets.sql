
-- This function finds users with a profile but no wallet and creates a wallet for them.
CREATE OR REPLACE FUNCTION public.create_missing_wallets()
RETURNS TEXT
LANGUAGE plpgsql
-- This function should be run by an authenticated user with the 'admin' role.
-- SECURITY DEFINER is not used here as we want to check the role of the CALLER.
AS $$
DECLARE
  missing_user RECORD;
  wallets_created_count INT := 0;
BEGIN
  -- 1. Check if the current user is an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Permission denied: Not an admin';
  END IF;

  -- 2. Loop through profiles that don't have a corresponding wallet
  FOR missing_user IN
    SELECT id FROM public.profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.wallets w WHERE w.user_id = p.id
    )
  LOOP
    -- 3. Insert a new wallet for the missing user
    INSERT INTO public.wallets (user_id) VALUES (missing_user.id);
    wallets_created_count := wallets_created_count + 1;
  END LOOP;

  -- 4. Return a confirmation message
  RETURN 'Created ' || wallets_created_count || ' missing wallet(s).';
END;
$$;
