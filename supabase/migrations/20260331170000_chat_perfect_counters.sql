-- Migration pour des compteurs de messages ultra-précis
-- Date: 2026-03-31

-- 1. Fonction pour recalculer les compteurs d'une conversation spécifique
CREATE OR REPLACE FUNCTION public.sync_chat_unread_counts(p_conversation_id UUID)
RETURNS VOID AS $$
DECLARE
    v_admin_unread INTEGER;
    v_user_unread INTEGER;
BEGIN
    -- Compter les messages non lus envoyés par l'utilisateur (à destination de l'admin)
    SELECT COUNT(*) INTO v_admin_unread
    FROM public.chat_messages
    WHERE conversation_id = p_conversation_id
    AND is_admin = FALSE
    AND read_at IS NULL;

    -- Compter les messages non lus envoyés par l'admin (à destination de l'utilisateur)
    SELECT COUNT(*) INTO v_user_unread
    FROM public.chat_messages
    WHERE conversation_id = p_conversation_id
    AND is_admin = TRUE
    AND read_at IS NULL;

    -- Mettre à jour la conversation
    UPDATE public.chat_conversations
    SET 
        admin_unread_count = v_admin_unread,
        user_unread_count = v_user_unread,
        updated_at = now()
    WHERE id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Mise à jour du trigger pour gérer INSERT et DELETE
CREATE OR REPLACE FUNCTION public.handle_chat_message_change()
RETURNS TRIGGER AS $$
DECLARE
    v_conv_id UUID;
BEGIN
    v_conv_id := COALESCE(NEW.conversation_id, OLD.conversation_id);

    -- Recalculer les compteurs pour cette conversation
    PERFORM public.sync_chat_unread_counts(v_conv_id);

    -- Si c'est un nouvel envoi, mettre à jour l'aperçu
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.chat_conversations
        SET 
            last_message_at = NEW.created_at,
            last_message_preview = substr(NEW.message, 1, 100),
            last_message_sender_id = NEW.sender_id
        WHERE id = v_conv_id;
    END IF;

    -- Si c'est une suppression, retrouver le nouveau dernier message
    IF (TG_OP = 'DELETE') THEN
        DECLARE
            v_last_msg RECORD;
        BEGIN
            SELECT created_at, message, sender_id INTO v_last_msg 
            FROM public.chat_messages 
            WHERE conversation_id = v_conv_id 
            ORDER BY created_at DESC LIMIT 1;

            IF FOUND THEN
                UPDATE public.chat_conversations
                SET 
                    last_message_at = v_last_msg.created_at,
                    last_message_preview = substr(v_last_msg.message, 1, 100),
                    last_message_sender_id = v_last_msg.sender_id
                WHERE id = v_conv_id;
            ELSE
                UPDATE public.chat_conversations
                SET last_message_preview = NULL
                WHERE id = v_conv_id;
            END IF;
        END;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Application du trigger global
DROP TRIGGER IF EXISTS tr_chat_message_sync ON public.chat_messages;
CREATE TRIGGER tr_chat_message_sync
    AFTER INSERT OR DELETE OR UPDATE OF read_at ON public.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_chat_message_change();
