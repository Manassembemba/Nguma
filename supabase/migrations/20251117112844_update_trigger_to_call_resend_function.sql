-- Met à jour la fonction et le trigger de notification par e-mail
-- pour appeler la nouvelle Edge Function 'send-resend-email'.

DROP FUNCTION IF EXISTS public.send_email_notification_on_new_transaction() CASCADE;

CREATE OR REPLACE FUNCTION public.send_email_notification_on_new_transaction()
RETURNS TRIGGER AS $$ 
DECLARE
    -- Le project_url est nécessaire pour appeler la nouvelle Edge Function.
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    payload JSONB;
    user_email TEXT;
    user_name TEXT;
BEGIN
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

    -- Call the new 'send-resend-email' edge function
    PERFORM net.http_post(
        url := project_url || '/functions/v1/send-resend-email',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := payload
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrée le trigger pour s'assurer qu'il est bien lié à la nouvelle fonction.
DROP TRIGGER IF EXISTS on_new_transaction_send_email ON public.transactions;
CREATE TRIGGER on_new_transaction_send_email
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.send_email_notification_on_new_transaction();