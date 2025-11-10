-- This migration creates a trigger and a trigger function.
-- The trigger fires after a new row is inserted into the 'notifications' table.
-- The trigger function then calls the 'send-email-notification' Edge Function.

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.trigger_send_email_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  -- Get the base URL of the project and the function secret from the Supabase Vault
  base_url TEXT := secrets.get('PROJECT_SUPABASE_URL');
  function_secret TEXT := secrets.get('FUNCTION_SECRET');
  -- Construct the full function URL
  function_url TEXT := base_url || '/functions/v1/send-email-notification';
BEGIN
  -- Check if required secrets are available
  IF base_url IS NULL OR function_secret IS NULL THEN
    RAISE LOG 'Missing PROJECT_SUPABASE_URL or FUNCTION_SECRET in Vault';
    RETURN NEW;
  END IF;

  -- Perform an HTTP POST request to the Edge Function using pg_net
  -- The body of the request contains the newly inserted notification record
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

-- 2. Create the trigger that executes the function after each new notification
CREATE TRIGGER on_new_notification_send_email
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_send_email_notification();
