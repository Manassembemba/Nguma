-- This migration updates the handle_new_user function to reflect changes in the profiles table.
-- It now initializes first_name and last_name instead of full_name.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile with new name fields
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );

  -- Insert wallet
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id);

  -- Assign investor role by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'investor');

  RETURN NEW;
END;
$$;
