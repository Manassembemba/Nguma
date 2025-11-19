-- Recreate the trigger function with the search_path directly in the definition
-- to ensure the 'secrets' schema is always found.

-- 1. Recreate the trigger function
CREATE OR REPLACE FUNCTION public.trigger_send_email_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions, vault -- Explicitly set the search path
AS $$
DECLARE
  base_url TEXT := secrets.get('PROJECT_SUPABASE_URL');
  function_secret TEXT := secrets.get('FUNCTION_SECRET');
  function_url TEXT := base_url || '/functions/v1/send-email-notification';
BEGIN
  IF base_url IS NULL OR function_secret IS NULL THEN
    RAISE LOG 'Missing PROJECT_SUPABASE_URL or FUNCTION_SECRET in Vault';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url:=function_url,
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || function_secret
    ),
    body:=jsonb_build_object('record', NEW)
  );
  
  RETURN NEW;
END;
$$;

-- 2. Re-link the trigger to be certain
-- (This might be redundant but ensures correctness)
DROP TRIGGER IF EXISTS on_new_notification_send_email ON public.notifications;
CREATE TRIGGER on_new_notification_send_email
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_send_email_notification();
