-- Migration pour l'automatisation des alertes email de chat
-- Date: 2026-03-31

-- Fonction de trigger pour envoyer des alertes email
CREATE OR REPLACE FUNCTION public.trigger_chat_email_notifications()
RETURNS TRIGGER AS $$
DECLARE
    v_recipient_email TEXT;
    v_recipient_name TEXT;
    v_sender_name TEXT;
    v_admin_emails TEXT[];
BEGIN
    -- 1. CAS : L'ADMIN RÉPOND À UN UTILISATEUR -> Notifier l'utilisateur
    IF NEW.is_admin = TRUE THEN
        -- Récupérer l'email et le nom de l'utilisateur de la conversation
        SELECT p.email, COALESCE(p.first_name || ' ' || p.last_name, p.email)
        INTO v_recipient_email, v_recipient_name
        FROM public.chat_conversations c
        JOIN public.profiles p ON c.user_id = p.id
        WHERE c.id = NEW.conversation_id;

        -- Insérer dans la file d'attente des emails
        IF v_recipient_email IS NOT NULL THEN
            INSERT INTO public.notifications_queue (template_id, recipient_email, notification_params)
            VALUES (
                'chat_new_message_user',
                v_recipient_email,
                jsonb_build_object(
                    'to', v_recipient_email,
                    'name', v_recipient_name,
                    'conversationId', NEW.conversation_id,
                    'message', NEW.message
                )
            );
        END IF;

    -- 2. CAS : L'UTILISATEUR ÉCRIT À L'ADMIN -> Notifier tous les admins
    ELSE
        -- Récupérer le nom de l'envoyeur
        SELECT COALESCE(first_name || ' ' || last_name, email)
        INTO v_sender_name
        FROM public.profiles
        WHERE id = NEW.sender_id;

        -- Récupérer les emails de tous les admins
        SELECT array_agg(p.email)
        INTO v_admin_emails
        FROM public.user_roles ur
        JOIN public.profiles p ON ur.user_id = p.id
        WHERE ur.role = 'admin';

        -- Insérer un email pour chaque admin
        IF v_admin_emails IS NOT NULL THEN
            DECLARE
                v_email TEXT;
            BEGIN
                FOREACH v_email IN ARRAY v_admin_emails LOOP
                    INSERT INTO public.notifications_queue (template_id, recipient_email, notification_params)
                    VALUES (
                        'chat_new_message_admin',
                        v_email,
                        jsonb_build_object(
                            'to', v_email,
                            'name', v_sender_name,
                            'email', (SELECT email FROM public.profiles WHERE id = NEW.sender_id),
                            'conversationId', NEW.conversation_id,
                            'message', NEW.message
                        )
                    );
                END LOOP;
            END;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Application du trigger
DROP TRIGGER IF EXISTS tr_chat_email_notifications ON public.chat_messages;
CREATE TRIGGER tr_chat_email_notifications
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_chat_email_notifications();
