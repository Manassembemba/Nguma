-- Fix handle_new_user function to match current profiles table structure
-- Critical fix for 500 error during user signup

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile with current table structure (first_name, last_name, post_nom instead of full_name)
  INSERT INTO public.profiles (id, email, first_name, last_name, post_nom)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'post_nom', '')
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
