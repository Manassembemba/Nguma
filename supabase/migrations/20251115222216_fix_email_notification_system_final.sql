-- Supprime tout ce qui existe pour être sûr
DROP TRIGGER IF EXISTS on_new_notification_send_email ON public.notifications;
DROP FUNCTION IF EXISTS public.trigger_send_email_notification();
DROP TRIGGER IF EXISTS "EnvoiEmailNotification" ON public.notifications;


-- Recrée la fonction de déclenchement CORRECTEMENT
CREATE OR REPLACE FUNCTION public.trigger_send_email_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
-- On définit le search_path directement ici pour être sûr
SET search_path = public, extensions, vault 
AS $$
DECLARE
  base_url TEXT;
  function_secret TEXT;
  function_url TEXT;
BEGIN
  -- On récupère les secrets
  SELECT decrypted_secret INTO base_url FROM vault.decrypted_secrets WHERE name = 'PROJECT_SUPABASE_URL';
  SELECT decrypted_secret INTO function_secret FROM vault.decrypted_secrets WHERE name = 'FUNCTION_SECRET';

  -- On vérifie que les secrets existent
  IF base_url IS NULL OR function_secret IS NULL THEN
    RAISE LOG 'Erreur: PROJECT_SUPABASE_URL ou FUNCTION_SECRET non trouvé dans le Vault.';
    RETURN NEW;
  END IF;

  -- On construit l'URL de la fonction
  function_url := base_url || '/functions/v1/send-email-notification';

  -- On fait l'appel HTTP avec le bon en-tête
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


-- On recrée le déclencheur
CREATE TRIGGER on_new_notification_send_email
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_send_email_notification();
