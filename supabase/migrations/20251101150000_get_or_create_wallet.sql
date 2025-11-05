
-- This function retrieves a user's wallet, creating one if it doesn't exist.
CREATE OR REPLACE FUNCTION public.get_or_create_wallet()
RETURNS SETOF public.wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID := auth.uid();
  user_wallet public.wallets;
BEGIN
  -- Try to select the wallet
  SELECT * INTO user_wallet FROM public.wallets WHERE user_id = target_user_id;

  -- If wallet does not exist, create it
  IF user_wallet IS NULL THEN
    INSERT INTO public.wallets (user_id) VALUES (target_user_id)
    RETURNING * INTO user_wallet;
  END IF;

  -- Return the found or newly created wallet
  RETURN NEXT user_wallet;
END;
$$;
