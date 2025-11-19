-- Re-applying the definitive trigger fix to ensure it's active.

-- First, clean up any potential remnants
DROP TRIGGER IF EXISTS on_new_notification_send_email ON public.notifications;
DROP FUNCTION IF EXISTS public.trigger_send_email_notification();
DROP TRIGGER IF EXISTS "EnvoiEmailNotification" ON public.notifications;


-- Recreate the trigger function with the most robust settings
CREATE OR REPLACE FUNCTION public.trigger_send_email_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions, vault 
AS $$
DECLARE
  base_url TEXT;
  function_secret TEXT;
  function_url TEXT;
BEGIN
  -- Fetch secrets from the UI Vault
  SELECT decrypted_secret INTO base_url FROM vault.decrypted_secrets WHERE name = 'PROJECT_SUPABASE_URL';
  SELECT decrypted_secret INTO function_secret FROM vault.decrypted_secrets WHERE name = 'FUNCTION_SECRET';

  -- Check if secrets were found
  IF base_url IS NULL OR function_secret IS NULL THEN
    RAISE LOG 'Erreur: PROJECT_SUPABASE_URL ou FUNCTION_SECRET non trouvé dans le Vault.';
    RETURN NEW;
  END IF;

  -- Build the function URL
  function_url := base_url || '/functions/v1/send-email-notification';

  -- Perform the HTTP POST call
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


-- Recreate the trigger
CREATE TRIGGER on_new_notification_send_email
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_send_email_notification();
