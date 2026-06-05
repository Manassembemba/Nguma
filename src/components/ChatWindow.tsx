import { useState, useEffect, useRef } from "react";
import { X, Menu, Search, MessageCircle, Loader2, MoreVertical, Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChatMessageList } from "./ChatMessageList";
import { ChatMessageInput } from "./ChatMessageInput";
import { ConversationHistory } from "./ConversationHistory";
import {
    getUserConversations,
    createNewConversation,
    getMessages,
    sendMessage,
    markConversationAsRead,
    subscribeToMessages,
    switchToConversation,
    setupTypingIndicator,
    subscribeToConversationStatus
} from "@/services/chatService";
import type { ChatMessage, ChatConversation } from "@/services/chatService";
import { uploadChatFile } from "@/services/fileUploadService";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getSettingByKey } from "@/services/settingsService";
import { Avatar, AvatarFallback } from "./ui/avatar";

interface ChatWindowProps {
    onClose: () => void;
}

export function ChatWindow({ onClose }: ChatWindowProps) {
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | undefined>();
    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);
    const [showHistory, setShowHistory] = useState(true); 
    const [isTyping, setIsTyping] = useState(false);
    const [whatsappNumber, setWhatsappNumber] = useState<string>('');
    const { toast } = useToast();
    
    const unsubscribeMessagesRef = useRef<(() => void) | null>(null);
    const unsubscribeStatusRef = useRef<(() => void) | null>(null);
    const typingRef = useRef<{ setTyping: (isTyping: boolean) => void; unsubscribe: () => void } | null>(null);

    // Initialisation
    useEffect(() => {
        const initialize = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setCurrentUserId(user.id);
            await loadSettings();
            await loadConversations(true);
        };
        initialize();

        return () => {
            unsubscribeMessagesRef.current?.();
            unsubscribeStatusRef.current?.();
            typingRef.current?.unsubscribe();
        };
    }, []);

    const loadSettings = async () => {
        try {
            const setting = await getSettingByKey('whatsapp_number');
            if (setting?.value) setWhatsappNumber(setting.value);
        } catch (error) { console.error('Error loading WhatsApp setting:', error); }
    };

    // Charger les conversations sans bloquer l'UI
    const loadConversations = async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);
            const convs = await getUserConversations();
            setConversations(convs);
            
            if (isInitial) {
                if (convs.length > 0) setActiveConversationId(convs[0].id);
                else {
                    const newId = await createNewConversation("Support Nguma");
                    setActiveConversationId(newId);
                }
            }
        } catch (error) {
            console.error('Error loading conversations:', error);
        } finally {
            if (isInitial) setLoading(false);
        }
    };

    // Charger les messages d'une conversation
    useEffect(() => {
        if (!activeConversationId) return;

        const fetchMessages = async () => {
            try {
                if (messages.length === 0) setLoadingMessages(true);
                
                const msgs = await getMessages(activeConversationId);
                setMessages(msgs);
                
                // Marquer comme lu
                markConversationAsRead(activeConversationId).catch(() => {});

                // S'abonner aux messages
                unsubscribeMessagesRef.current?.();
                unsubscribeMessagesRef.current = subscribeToMessages(activeConversationId, (newMessage) => {
                    setMessages(prev => {
                        if (prev.some(m => m.id === newMessage.id)) return prev;
                        return [...prev, newMessage];
                    });
                    if (newMessage.sender_id !== currentUserId) {
                        markConversationAsRead(activeConversationId).catch(() => {});
                    }
                });

                // Souscription au statut de l'IA (Typing indicator)
                unsubscribeStatusRef.current?.();
                unsubscribeStatusRef.current = subscribeToConversationStatus(activeConversationId, (conv) => {
                    if (conv.ai_status === 'thinking' || conv.ai_status === 'typing') {
                        setIsTyping(true);
                    } else {
                        setIsTyping(false);
                    }
                });

                // Setup typing indicator
                setupTyping(activeConversationId);
            } catch (error) {
                console.error('Error loading messages:', error);
            } finally {
                setLoadingMessages(false);
            }
        };

        fetchMessages();
        return () => {
            unsubscribeMessagesRef.current?.();
            unsubscribeStatusRef.current?.();
        };
    }, [activeConversationId]);

    const setupTyping = (conversationId: string) => {
        typingRef.current?.unsubscribe();
        typingRef.current = setupTypingIndicator(conversationId, (users) => {
            const othersTyping = users.filter(id => id !== currentUserId).length > 0;
            setIsTyping(othersTyping);
        });
    };

    const handleSelectConversation = async (id: string) => {
        if (id === activeConversationId) return;
        await switchToConversation(id);
        setMessages([]);
        setActiveConversationId(id);
        if (window.innerWidth < 768) setShowHistory(false);
    };

    const handleNewConversation = async () => {
        try {
            const newId = await createNewConversation();
            await loadConversations(false);
            setActiveConversationId(newId);
            if (window.innerWidth < 768) setShowHistory(false);
        } catch (error) {
            toast({ title: "Erreur", description: "Impossible de créer une discussion.", variant: "destructive" });
        }
    };

    const handleSendMessage = async (message: string, files?: File[]) => {
        if (!activeConversationId) return;
        try {
            setSending(true);
            typingRef.current?.setTyping(false);
            const messageId = await sendMessage(activeConversationId, message);
            if (files && files.length > 0) {
                for (const file of files) await uploadChatFile(file, messageId);
            }
        } catch (error) {
            toast({ title: "Erreur", description: "Échec de l'envoi.", variant: "destructive" });
        } finally { setSending(false); }
    };

    const activeConv = conversations.find(c => c.id === activeConversationId);

    return (
        <Card className="fixed inset-0 md:inset-auto md:bottom-4 md:right-4 w-full md:w-[450px] lg:w-[950px] h-full md:h-[600px] lg:h-[750px] md:max-h-[90vh] shadow-2xl flex flex-row z-50 overflow-hidden md:rounded-lg border-none animate-in zoom-in-95 duration-200">
            {/* Sidebar */}
            <div className={`${showHistory ? 'flex' : 'hidden'} md:flex w-full md:w-80 lg:w-[350px] flex-shrink-0 flex-col border-r border-[#222d34]`}>
                <ConversationHistory
                    conversations={conversations}
                    activeConversationId={activeConversationId}
                    onSelectConversation={handleSelectConversation}
                    onNewConversation={handleNewConversation}
                />
            </div>

            {/* Chat Area */}
            <div className={`${!showHistory ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0 h-full bg-[#0b141a]`}>
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center bg-[#0b141a]">
                        <Loader2 className="h-10 w-10 animate-spin text-[#00a884] mb-4" />
                        <p className="text-sm text-[#8696a0]">Chargement...</p>
                    </div>
                ) : activeConversationId ? (
                    <>
                        <div className="h-16 flex-shrink-0 bg-[#202c33] px-4 flex items-center justify-between border-b border-[#222d34] shadow-sm z-20">
                            <div className="flex items-center gap-3 min-w-0">
                                <Button variant="ghost" size="icon" className="md:hidden -ml-2 text-[#aebac1]" onClick={() => setShowHistory(true)}>
                                    <Menu className="h-5 w-5" />
                                </Button>
                                <Avatar className="h-10 w-10 border border-[#313d45]">
                                    <AvatarFallback className="bg-[#6a7175] text-[#e9edef] font-bold">
                                        {activeConv?.subject?.charAt(0) || "S"}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col truncate">
                                    <h2 className="text-[15px] font-medium text-[#e9edef] truncate">
                                        {activeConv?.subject || "Support Nguma"}
                                    </h2>
                                    <span className="text-[11px] text-[#8696a0] font-normal">
                                        {isTyping ? "en train d'écrire..." : "En ligne"}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={onClose} className="text-[#aebac1] rounded-full h-10 w-10 hover:bg-[#374248]">
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden relative">
                            {loadingMessages && <div className="absolute inset-0 bg-[#0b141a]/50 flex items-center justify-center z-50"><Loader2 className="h-8 w-8 animate-spin text-[#00a884]" /></div>}
                            <ChatMessageList messages={messages} currentUserId={currentUserId} isTyping={isTyping} />
                        </div>

                        <div className="bg-[#202c33]">
                            <ChatMessageInput
                                onSend={handleSendMessage}
                                onTyping={(typing) => typingRef.current?.setTyping(typing)}
                                disabled={sending}
                            />
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center bg-[#111b21] px-8 text-center">
                        <div className="w-64 h-64 bg-[#202c33] rounded-full flex items-center justify-center mb-8">
                            <MessageCircle className="h-32 w-32 text-[#3b4a54]" />
                        </div>
                        <h2 className="text-2xl font-light text-[#e9edef] mb-4">Support Nguma</h2>
                        <p className="text-sm text-[#8696a0] max-w-xs leading-relaxed">
                            Envoyez et recevez des messages de support en toute sécurité.
                        </p>
                    </div>
                )}
            </div>
        </Card>
    );
}
