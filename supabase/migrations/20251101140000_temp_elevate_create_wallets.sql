
-- Temporarily elevate privileges for the create_missing_wallets function so it can be run from the SQL editor
CREATE OR REPLACE FUNCTION public.create_missing_wallets()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER -- Run with the permissions of the user who defined it (postgres)
SET search_path = public
AS $$
DECLARE
  missing_user RECORD;
  wallets_created_count INT := 0;
BEGIN
  -- The role check is now bypassed when run from SQL editor due to SECURITY DEFINER
  -- but would still work if called from the app by a non-admin.
  IF NOT public.has_role(auth.uid(), 'admin') AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Permission denied: Not an admin';
  END IF;

  FOR missing_user IN
    SELECT id FROM public.profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.wallets w WHERE w.user_id = p.id
    )
  LOOP
    INSERT INTO public.wallets (user_id) VALUES (missing_user.id);
    wallets_created_count := wallets_created_count + 1;
  END LOOP;

  RETURN 'Created ' || wallets_created_count || ' missing wallet(s).';
END;
$$;
