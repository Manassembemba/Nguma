import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ChatConversation = Database['public']['Tables']['chat_conversations']['Row'];
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];
export type ChatAttachment = Database['public']['Tables']['chat_attachments']['Row'];
export type ChatAnalytics = Database['public']['Tables']['chat_analytics']['Row'];

export interface AdminConversation {
    id: string;
    user_id: string;
    user_email: string;
    user_full_name: string;
    subject: string;
    status: string;
    last_message_at: string | null;
    admin_unread_count: number;
    created_at: string;
    last_message_preview: string | null;
}

export interface SearchResult {
    id: string;
    conversation_id: string;
    sender_id: string;
    message: string;
    is_admin: boolean;
    created_at: string;
    rank: number;
}

/**
 * Récupère ou crée la conversation de l'utilisateur courant
 */
export const getUserConversation = async (): Promise<string> => {
    const { data, error } = await supabase.rpc('get_or_create_user_conversation');
    if (error) throw new Error(error.message);
    return data as string;
};

/**
 * Récupère TOUTES les conversations de l'utilisateur (historique)
 */
export const getUserConversations = async (): Promise<ChatConversation[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) throw new Error(error.message);
    return data || [];
};

/**
 * Crée une nouvelle conversation pour l'utilisateur
 */
export const createNewConversation = async (title?: string): Promise<string> => {
    const { data, error } = await supabase.rpc('create_new_conversation', {
        p_title: title || null
    });
    if (error) throw new Error(error.message);
    return data as string;
};

/**
 * Récupère toutes les conversations pour les admins (Version Robuste sans jointure problématique)
 */
export const getAdminConversations = async (status?: 'open' | 'closed'): Promise<AdminConversation[]> => {
    // 1. Récupérer les conversations
    let query = supabase
        .from('chat_conversations')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false });

    if (status) {
        query = query.eq('status', status);
    }

    const { data: conversations, error } = await query;
    if (error) throw new Error(error.message);
    if (!conversations || conversations.length === 0) return [];

    // 2. Récupérer les IDs d'utilisateurs uniques
    const userIds = [...new Set(conversations.map(c => c.user_id))];

    // 3. Récupérer les profils correspondants
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .in('id', userIds);

    const profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
    }, {} as Record<string, any>);

    // 4. Fusionner les données
    return conversations.map(conv => {
        const profile = profileMap[conv.user_id];
        const fullName = profile
            ? (profile.first_name && profile.last_name ? `${profile.first_name} ${profile.last_name}` : profile.email)
            : 'Utilisateur inconnu';

        return {
            id: conv.id,
            user_id: conv.user_id,
            user_email: profile?.email || 'Email inconnu',
            user_full_name: fullName,
            subject: conv.subject || 'Support',
            status: conv.status || 'open',
            last_message_at: conv.last_message_at,
            admin_unread_count: conv.admin_unread_count || 0,
            created_at: conv.created_at,
            last_message_preview: conv.last_message_preview
        };
    });
};

/**
 * Récupère les messages d'une conversation avec pagination
 */
export const getMessages = async (
    conversationId: string, 
    limit: number = 20, 
    offset: number = 0
): Promise<ChatMessage[]> => {
    const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false }) // On récupère du plus récent au plus ancien pour l'offset
        .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    
    // On remet les messages dans l'ordre chronologique pour l'affichage
    return (data || []).reverse();
};

/**
 * Envoie un message dans une conversation
 */
export const sendMessage = async (conversationId: string, message: string): Promise<string> => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) throw new Error('Le message ne peut pas être vide');

    // SÉCURITÉ : Bloquer les tentatives d'injection de scripts (XSS)
    const dangerousPatterns = [/<script/i, /javascript:/i, /on\w+=/i, /<iframe/i];
    if (dangerousPatterns.some(pattern => dangerousPatterns.some(p => p.test(trimmedMessage)))) {
        throw new Error('Contenu non autorisé détecté par le système de sécurité.');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Vérifier si admin
    const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin');
    const isAdmin = roles && roles.length > 0;

    // Insertion du message
    const { data: messageData, error: messageError } = await supabase
        .from('chat_messages')
        .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            message: trimmedMessage,
            is_admin: isAdmin
        })
        .select()
        .single();

    if (messageError) throw new Error(messageError.message);
    return messageData.id;
};

/**
 * Marque une conversation comme lue
 */
export const markConversationAsRead = async (conversationId: string): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin');
    const isAdmin = roles && roles.length > 0;

    const { error } = await supabase.rpc('mark_chat_as_read', {
        p_conversation_id: conversationId,
        p_is_admin: isAdmin
    });

    if (error) console.error('Error marking as read:', error.message);
};

/**
 * Ferme une conversation (admin seulement)
 */
export const closeConversation = async (conversationId: string): Promise<void> => {
    const { error } = await supabase
        .from('chat_conversations')
        .update({ status: 'closed' })
        .eq('id', conversationId);

    if (error) throw new Error(error.message);
};

/**
 * Souscrit aux nouveaux messages d'une conversation (Realtime)
 */
export const subscribeToMessages = (
    conversationId: string,
    callback: (message: ChatMessage) => void
) => {
    const channel = supabase
        .channel(`chat_messages:${conversationId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `conversation_id=eq.${conversationId}`
            },
            (payload) => {
                callback(payload.new as ChatMessage);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

/**
 * Gère le statut "Typing" via Supabase Presence
 */
export const setupTypingIndicator = (
    conversationId: string,
    onTypingChange: (users: string[]) => void
) => {
    const channel = supabase.channel(`typing:${conversationId}`);

    channel
        .on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            const typingUsers = Object.values(state)
                .flat()
                .filter((p: any) => p.isTyping)
                .map((p: any) => p.user_id);
            onTypingChange(typingUsers);
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await channel.track({ user_id: user.id, isTyping: false });
                }
            }
        });

    const setTyping = async (isTyping: boolean) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await channel.track({ user_id: user.id, isTyping });
        }
    };

    return {
        unsubscribe: () => supabase.removeChannel(channel),
        setTyping
    };
};

/**
 * Souscrit aux changements de conversations (Realtime) - Pour admin
 */
export const subscribeToConversations = (
    callback: (conversation: ChatConversation) => void
) => {
    const channel = supabase
        .channel('chat_conversations_changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'chat_conversations'
            },
            (payload) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    callback(payload.new as ChatConversation);
                }
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

/**
 * Supprime un message de chat (Admin seulement)
 */
export const deleteChatMessage = async (messageId: string): Promise<void> => {
    const { data, error } = await supabase.rpc('delete_chat_message', {
        p_message_id: messageId
    });

    if (error) throw new Error(error.message);
    if (data && data.success === false) throw new Error(data.error);
};

/**
 * Met à jour le titre d'une conversation
 */
export const updateConversationTitle = async (conversationId: string, title: string): Promise<void> => {
    const { error } = await supabase
        .from('chat_conversations')
        .update({ subject: title })
        .eq('id', conversationId);

    if (error) throw new Error(error.message);
};

/**
 * Bascule vers une conversation existante (la rend active)
 */
export const switchToConversation = async (conversationId: string): Promise<void> => {
    const { error } = await supabase.rpc('switch_to_conversation', {
        p_conversation_id: conversationId
    });

    if (error) throw new Error(error.message);
};

/**
 * Récupère le nombre de messages non lus pour l'utilisateur
 */
export const getUnreadCount = async (): Promise<number> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return 0;
        const { data, error } = await supabase
            .from('chat_conversations')
            .select('user_unread_count')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single();
        return data?.user_unread_count || 0;
    } catch (error) {
        return 0;
    }
};
