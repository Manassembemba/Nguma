import { useState, useEffect, useRef } from "react";
import { 
    X, Menu, Search, MoreVertical, MessageCircle, CheckCircle, Loader2,
    Archive, Trash2, History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { ChatMessageList } from "@/components/ChatMessageList";
// import { ChatMessageInput } from "@/components/ChatMessageInput";
/*
import {
    getAdminConversations,
    getMessages,
    sendMessage,
    markConversationAsRead,
    closeConversation,
    subscribeToMessages,
    subscribeToConversations
} from "@/services/chatService";
// import type { AdminConversation, ChatMessage } from "@/services/chatService";
*/
import { uploadChatFile } from "@/services/fileUploadService";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const MESSAGES_PER_PAGE = 20;

export default function AdminSupportPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [conversations, setConversations] = useState<any[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [currentAdminId, setCurrentAdminId] = useState<string | undefined>();
    const [loading, setLoading] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [sending, setSending] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | undefined>('open');
    const [searchQuery, setSearchQuery] = useState("");
    const { toast } = useToast();
    
    const unsubscribeMessagesRef = useRef<(() => void) | null>(null);
    const unsubscribeConversationsRef = useRef<(() => void) | null>(null);

    // Initialisation
    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) setCurrentAdminId(data.user.id);
        });
    }, []);

    // Charger les conversations (Désactivé pour GitHub)
    const loadConversations = async (isInitial = false) => {
        /*
        try {
            if (isInitial) setLoading(true);
            const convs = await getAdminConversations(statusFilter);
            setConversations(convs);
            
            const convIdFromUrl = searchParams.get('conversation');
            if (isInitial && convIdFromUrl && convs.some(c => c.id === convIdFromUrl)) {
                setSelectedConversation(convIdFromUrl);
            }
        } catch (error) {
            console.error('Error loading conversations:', error);
        } finally {
            if (isInitial) setLoading(false);
        }
        */
    };

    useEffect(() => {
        loadConversations(true);
        // unsubscribeConversationsRef.current = subscribeToConversations(() => loadConversations(false));
        return () => unsubscribeConversationsRef.current?.();
    }, [statusFilter]);

    // Charger les messages initiaux (Désactivé pour GitHub)
    useEffect(() => {
        if (!selectedConversation) {
            setMessages([]);
            setHasMore(false);
            return;
        }

        const fetchInitialMessages = async () => {
            /*
            try {
                setLoadingMessages(true);
                const msgs = await getMessages(selectedConversation, MESSAGES_PER_PAGE, 0);
                setMessages(msgs);
                setHasMore(msgs.length === MESSAGES_PER_PAGE);
                
                markConversationAsRead(selectedConversation).catch(() => {});

                // Souscription Realtime
                unsubscribeMessagesRef.current?.();
                unsubscribeMessagesRef.current = subscribeToMessages(selectedConversation, (newMessage) => {
                    setMessages(prev => {
                        if (prev.some(m => m.id === newMessage.id)) return prev;
                        return [...prev, newMessage];
                    });
                    if (!newMessage.is_admin) markConversationAsRead(selectedConversation).catch(() => {});
                });
            } catch (error) {
                console.error('Error loading messages:', error);
            } finally {
                setLoadingMessages(false);
            }
            */
        };

        fetchInitialMessages();
        return () => unsubscribeMessagesRef.current?.();
    }, [selectedConversation]);

    // Charger plus de messages (Pagination)
    const handleLoadMore = async () => {
        if (!selectedConversation || loadingMore || !hasMore) return;
        /*
        try {
            setLoadingMore(true);
            const offset = messages.length;
            const olderMsgs = await getMessages(selectedConversation, MESSAGES_PER_PAGE, offset);
            
            if (olderMsgs.length > 0) {
                setMessages(prev => [...olderMsgs, ...prev]);
                setHasMore(olderMsgs.length === MESSAGES_PER_PAGE);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error('Error loading more messages:', error);
        } finally {
            setLoadingMore(false);
        }
        */
    };

    const handleSelectConversation = (id: string) => {
        if (id === selectedConversation) return;
        setMessages([]); 
        setSelectedConversation(id);
    };

    const handleSendMessage = async (message: string, files?: File[]) => {
        if (!selectedConversation || (!message.trim() && (!files || files.length === 0))) return;
        /*
        try {
            setSending(true);
            const messageId = await sendMessage(selectedConversation, message);
            if (files && files.length > 0) {
                for (const file of files) await uploadChatFile(file, messageId);
            }
        } catch (error) {
            toast({ title: "Erreur", description: "Impossible d'envoyer.", variant: "destructive" });
        } finally { setSending(false); }
        */
    };

    const handleCloseConversation = async () => {
        if (!selectedConversation) return;
        /*
        try {
            await closeConversation(selectedConversation);
            toast({ title: "Fermé", description: "Discussion classée." });
            loadConversations(false);
            setSelectedConversation(null);
        } catch (error) {
            toast({ title: "Erreur", description: "Action impossible.", variant: "destructive" });
        }
        */
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        if (isToday(date)) return format(date, "HH:mm");
        if (isYesterday(date)) return "Hier";
        return format(date, "dd/MM/yy");
    };

    const filteredConversations = conversations.filter(c => 
        c.user_full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.user_email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedConvData = conversations.find(c => c.id === selectedConversation);

    return (
        <div className="fixed inset-0 top-[64px] left-0 md:left-[280px] bg-[#0b141a] z-0 flex items-center justify-center overflow-hidden">
            <div className="max-w-md w-full p-8 text-center bg-[#111b21] rounded-[2rem] border border-[#222d34] shadow-2xl">
                <div className="w-20 h-20 bg-[#00a884]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <MessageCircle className="h-10 w-10 text-[#00a884]" />
                </div>
                <h1 className="text-2xl font-black text-[#e9edef] mb-4">Module Admin Chat</h1>
                <p className="text-[#8696a0] leading-relaxed mb-8">
                    Ce module de gestion des messages est configuré pour un usage **local uniquement**. 
                    Il a été désactivé pour la version déployée sur GitHub afin de protéger la confidentialité des échanges.
                </p>
                <div className="p-4 bg-[#202c33] rounded-2xl text-xs font-mono text-[#00a884] text-left border border-[#222d34]">
                    // Local access only<br/>
                    // Status: DEACTIVATED_ON_PROD
                </div>
            </div>
        </div>
    );
}
