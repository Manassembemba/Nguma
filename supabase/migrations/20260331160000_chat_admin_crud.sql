-- Migration pour les fonctions CRUD Admin du Chat
-- Date: 2026-03-31

-- 1. Fonction pour supprimer un message de chat (Admin seulement)
CREATE OR REPLACE FUNCTION public.delete_chat_message(p_message_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_conv_id UUID;
    v_last_msg RECORD;
    v_is_admin BOOLEAN;
BEGIN
    -- Vérifier si l'utilisateur est admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Action non autorisée.');
    END IF;

    -- Récupérer l'ID de la conversation avant suppression
    SELECT conversation_id INTO v_conv_id FROM public.chat_messages WHERE id = p_message_id;

    IF v_conv_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Message introuvable.');
    END IF;

    -- Supprimer le message
    DELETE FROM public.chat_messages WHERE id = p_message_id;

    -- Mettre à jour les métadonnées de la conversation avec le message précédent
    SELECT created_at, message, sender_id INTO v_last_msg 
    FROM public.chat_messages 
    WHERE conversation_id = v_conv_id 
    ORDER BY created_at DESC 
    LIMIT 1;

    IF FOUND THEN
        UPDATE public.chat_conversations
        SET 
            last_message_at = v_last_msg.created_at,
            last_message_preview = substr(v_last_msg.message, 1, 100),
            last_message_sender_id = v_last_msg.sender_id
        WHERE id = v_conv_id;
    ELSE
        -- Plus aucun message dans la conversation
        UPDATE public.chat_conversations
        SET 
            last_message_at = created_at,
            last_message_preview = NULL,
            last_message_sender_id = NULL
        WHERE id = v_conv_id;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
