-- Met à jour la fonction d'envoi de notification par e-mail pour utiliser le schéma 'vault'
-- au lieu du schéma 'secrets' déprécié, résolvant l'erreur "schema "secrets" does not exist".

CREATE OR REPLACE FUNCTION public.send_email_notification_on_new_transaction()
RETURNS TRIGGER AS $$ 
DECLARE
    base_url TEXT;
    function_secret TEXT;
    payload JSONB;
    user_email TEXT;
    user_name TEXT;
BEGIN
    -- On récupère les secrets depuis le schéma 'vault' (la nouvelle méthode)
    SELECT decrypted_secret INTO base_url FROM vault.decrypted_secrets WHERE name = 'PROJECT_SUPABASE_URL';
    SELECT decrypted_secret INTO function_secret FROM vault.decrypted_secrets WHERE name = 'FUNCTION_SECRET';

    -- On vérifie que les secrets existent
    IF base_url IS NULL OR function_secret IS NULL THEN
        -- On arrête la fonction si les secrets ne sont pas trouvés, sans causer d'erreur
        RETURN NEW;
    END IF;

    -- Get user details
    SELECT u.email, p.first_name || ' ' || p.last_name INTO user_email, user_name
    FROM auth.users u
    JOIN public.profiles p ON u.id = p.id
    WHERE u.id = NEW.user_id;

    -- Construct the payload for the edge function
    payload := jsonb_build_object(
        'to', user_email,
        'subject', 'Confirmation de votre transaction',
        'name', user_name,
        'amount', NEW.amount,
        'type', NEW.type,
        'status', NEW.status
    );

    -- Call the edge function to send the email
    PERFORM net.http_post(
        url := base_url || '/functions/v1/send-email-notification',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || function_secret
        ),
        body := payload
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Assurez-vous que le trigger est bien en place
-- Si le trigger existe déjà, cette commande ne fera rien.
-- Si le trigger a été supprimé, elle le recréera.
DROP TRIGGER IF EXISTS on_new_transaction_send_email ON public.transactions;
CREATE TRIGGER on_new_transaction_send_email
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.send_email_notification_on_new_transaction();