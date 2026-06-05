import { supabase } from "@/integrations/supabase/client";

/**
 * Appelle l'Edge Function chat-ai pour obtenir une réponse de l'IA
 * @param conversationId ID de la conversation
 * @param message Message de l'utilisateur
 */
export const callChatAI = async (conversationId: string, message: string) => {
    console.log(`[aiChatService] Calling AI for conversation ${conversationId}`);
    
    try {
        const { data, error } = await supabase.functions.invoke('chat-ai', {
            body: { conversationId, message }
        });

        if (error) {
            console.error('[aiChatService] Error calling chat-ai function:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('[aiChatService] Critical error in callChatAI:', error);
        throw error;
    }
};

/**
 * Ancien service, maintenu pour la compatibilité si nécessaire
 */
export const getAiResponse = async () => { 
    return null; 
};
