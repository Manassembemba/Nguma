import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatMessageList } from "@/components/ChatMessageList";
import { ChatMessageInput } from "@/components/ChatMessageInput";
import { getSettingByKey } from "@/services/settingsService";
import { getUserConversation, getMessages, sendMessage, markConversationAsRead, subscribeToMessages, updateConversationTitle, subscribeToConversationStatus } from "@/services/chatService";
import type { ChatMessage } from "@/services/chatService";
import { uploadChatFile } from "@/services/fileUploadService";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function SupportPage() {
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | undefined>();
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [humanRequested, setHumanRequested] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [isActiveUser, setIsActiveUser] = useState(false);
    const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
    const { toast } = useToast();
    const unsubscribeRef = useRef<(() => void) | null>(null);
    const unsubscribeStatusRef = useRef<(() => void) | null>(null);

    // Initialiser la conversation et charger les messages
    useEffect(() => {
        const init = async () => {
            try {
                setLoading(true);

                // Check user active status
                let isActive = false;
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.banned_until) {
                    const bannedUntilDate = new Date(user.banned_until);
                    const now = new Date();
                    isActive = bannedUntilDate < now;
                    setIsActiveUser(isActive);
                } else {
                    isActive = true;
                    setIsActiveUser(true);
                }

                // If user is active, fetch WhatsApp number
                if (isActive) {
                    const setting = await getSettingByKey('support_whatsapp_number');
                    if (setting && setting.value) {
                        setWhatsappNumber(setting.value);
                    }
                }

                // Initialize chat
                const convId = await getUserConversation();
                setConversationId(convId);
                if (user) setCurrentUserId(user.id);

                const msgs = await getMessages(convId);
                setMessages(msgs);

                // Marquer comme lu
                await markConversationAsRead(convId);

                // S'abonner aux nouveaux messages (Realtime)
                unsubscribeRef.current = subscribeToMessages(convId, (newMessage) => {
                    setMessages(prev => [...prev, newMessage]);
                    // Marquer automatiquement comme lu
                    markConversationAsRead(convId).catch(console.error);
                });

                // S'abonner aux changements de statut (AI thinking)
                unsubscribeStatusRef.current = subscribeToConversationStatus(convId, (conv) => {
                    if (conv.ai_status === 'thinking' || conv.ai_status === 'typing') {
                        setIsTyping(true);
                    } else {
                        setIsTyping(false);
                    }
                });
            } catch (error) {
                console.error('Error initializing chat:', error);
                toast({
                    title: "Erreur",
                    description: "Impossible de charger le chat. Veuillez réessayer.",
                    variant: "destructive"
                });
            } finally {
                setLoading(false);
            }
        };

        init();

        // Nettoyer la souscription lors du démontage
        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
            if (unsubscribeStatusRef.current) {
                unsubscribeStatusRef.current();
            }
        };
    }, [toast]);

    const handleSendMessage = async (message: string, files?: File[]) => {
        if (!conversationId || (!message.trim() && (!files || files.length === 0))) return;

        try {
            setSending(true);

            // Détecter si l'utilisateur demande à parler à un humain
            const humanKeywords = ['parler à un conseiller', 'conseiller humain', 'agent humain', 'parler à un humain'];
            if (humanKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
                setHumanRequested(true);
            }

            // Vérifier si c'est le premier message de la conversation (pour générer le titre)
            const isFirstMessage = messages.length === 0;

            // Envoyer le message
            const messageId = await sendMessage(conversationId, message);

            // Upload des fichiers si présents
            if (files && files.length > 0) {
                for (const file of files) {
                    try {
                        await uploadChatFile(file, messageId);
                    } catch (fileError) {
                        console.error('File upload error:', fileError);
                        toast({
                            title: "Avertissement",
                            description: `Impossible d'uploader ${file.name}`,
                            variant: "destructive"
                        });
                    }
                }
            }

            // Générer le titre automatiquement au premier message
            if (isFirstMessage) {
                setTimeout(async () => {
                    await updateConversationTitle(conversationId);
                }, 500);
            }

            // Appeler l'IA après un court délai si message texte présent
            if (message.trim()) {
                setIsTyping(true);
                setTimeout(async () => {
                    try {
                        const { callChatAI } = await import('@/services/aiChatService');
                        await callChatAI(conversationId, message);
                    } catch (aiError) {
                        console.error('AI response error:', aiError);
                        setIsTyping(false);
                    }
                }, 500);
            }

        } catch (error) {
            console.error('Error sending message:', error);
            toast({
                title: "Erreur",
                description: "Impossible d'envoyer le message. Veuillez réessayer.",
                variant: "destructive"
            });
        } finally {
            setSending(false);
        }
    };

    const whatsappLink = whatsappNumber ? `https://wa.me/${whatsappNumber.replace(/\s/g, '')}` : '';

    return (
        <div className="container mx-auto p-2 sm:p-4 md:p-6 max-w-4xl h-[calc(100vh-64px)] md:h-auto flex flex-col">
            <div className="mb-4 sm:mb-6 px-2">
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                    <MessageCircle className="h-6 w-6 sm:h-8 sm:h-8" />
                    Support
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
                    Contactez notre équipe de support. Nous sommes là pour vous aider.
                </p>
            </div>

            {isActiveUser && whatsappNumber && (
                <Card className="mb-4 sm:mb-6 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                    <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-1">
                            <p className="text-[10px] sm:text-sm font-medium text-green-800 dark:text-green-200 uppercase tracking-wider">
                                Contact direct :
                            </p>
                            <p className="text-base sm:text-lg font-bold text-green-900 dark:text-green-100 mt-0.5">
                                <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                    {whatsappNumber} (WhatsApp)
                                </a>
                            </p>
                        </div>
                        <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto text-center px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 active:scale-95">
                            WhatsApp
                        </a>
                    </CardContent>
                </Card>
            )}

            <Card className="flex-1 flex flex-col overflow-hidden border-none sm:border bg-[#111b21] sm:bg-background">
                <CardHeader className="border-b py-3 sm:py-4 px-4 sm:px-6">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        Conversation
                    </CardTitle>
                </CardHeader>

                <CardContent className="flex-1 p-0 flex flex-col overflow-hidden relative">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
                            <ChatMessageList
                                messages={messages}
                                onSuggestionClick={handleSendMessage}
                                isTyping={isTyping}
                                currentUserId={currentUserId}
                            />
                            <div className="mt-auto border-t bg-background">
                                <ChatMessageInput
                                    onSend={handleSendMessage}
                                    disabled={sending}
                                    aiOnlyMode={!humanRequested && !messages.some(msg => msg.is_admin)}
                                />
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
