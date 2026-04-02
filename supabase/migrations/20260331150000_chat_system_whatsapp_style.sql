-- Migration pour le système de chat "WhatsApp Style"
-- Date: 2026-03-31

-- 1. Ajout des colonnes pour la prévisualisation et le suivi du dernier expéditeur
ALTER TABLE public.chat_conversations 
ADD COLUMN IF NOT EXISTS last_message_preview TEXT,
ADD COLUMN IF NOT EXISTS last_message_sender_id UUID;

-- 2. Fonction RPC pour marquer une conversation comme lue
-- Gère intelligemment les compteurs admin vs utilisateur
CREATE OR REPLACE FUNCTION public.mark_chat_as_read(p_conversation_id UUID, p_is_admin BOOLEAN)
RETURNS VOID AS $$
BEGIN
    IF p_is_admin THEN
        UPDATE public.chat_conversations 
        SET admin_unread_count = 0 
        WHERE id = p_conversation_id;
    ELSE
        UPDATE public.chat_conversations 
        SET user_unread_count = 0 
        WHERE id = p_conversation_id;
    END IF;
    
    -- Marquer les messages individuels comme lus (ceux qui ne viennent pas de nous)
    UPDATE public.chat_messages
    SET read_at = now()
    WHERE conversation_id = p_conversation_id
    AND is_admin != p_is_admin
    AND read_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fonction de trigger pour mettre à jour les métadonnées de conversation lors d'un nouveau message
CREATE OR REPLACE FUNCTION public.handle_new_chat_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.chat_conversations
    SET 
        last_message_at = NEW.created_at,
        last_message_preview = substr(NEW.message, 1, 100),
        last_message_sender_id = NEW.sender_id,
        -- Incrémenter le compteur de non-lus pour l'autre partie
        admin_unread_count = CASE WHEN NOT NEW.is_admin THEN admin_unread_count + 1 ELSE admin_unread_count END,
        user_unread_count = CASE WHEN NEW.is_admin THEN user_unread_count + 1 ELSE user_unread_count END,
        updated_at = now()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Application du trigger sur la table chat_messages
DROP TRIGGER IF EXISTS tr_handle_new_chat_message ON public.chat_messages;
CREATE TRIGGER tr_handle_new_chat_message
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_chat_message();

-- 4. Fonction pour basculer vers une conversation (la rendre active)
CREATE OR REPLACE FUNCTION public.switch_to_conversation(p_conversation_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Désactiver l'ancienne conversation active de l'utilisateur
    UPDATE public.chat_conversations
    SET is_active = false
    WHERE user_id = (SELECT user_id FROM public.chat_conversations WHERE id = p_conversation_id)
    AND id != p_conversation_id;

    -- Activer la nouvelle
    UPDATE public.chat_conversations
    SET is_active = true
    WHERE id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
