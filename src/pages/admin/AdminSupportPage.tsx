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
import { ChatMessageList } from "@/components/ChatMessageList";
import { ChatMessageInput } from "@/components/ChatMessageInput";
import {
    getAdminConversations,
    getMessages,
    sendMessage,
    markConversationAsRead,
    closeConversation,
    subscribeToMessages,
    subscribeToConversations
} from "@/services/chatService";
import type { AdminConversation, ChatMessage } from "@/services/chatService";
import { uploadChatFile } from "@/services/fileUploadService";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const MESSAGES_PER_PAGE = 20;

export default function AdminSupportPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [conversations, setConversations] = useState<AdminConversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [currentAdminId, setCurrentAdminId] = useState<string | undefined>();
    const [loading, setLoading] = useState(true);
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

    // Charger les conversations
    const loadConversations = async (isInitial = false) => {
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
    };

    useEffect(() => {
        loadConversations(true);
        unsubscribeConversationsRef.current = subscribeToConversations(() => loadConversations(false));
        return () => unsubscribeConversationsRef.current?.();
    }, [statusFilter]);

    // Charger les messages initiaux
    useEffect(() => {
        if (!selectedConversation) {
            setMessages([]);
            setHasMore(false);
            return;
        }

        const fetchInitialMessages = async () => {
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
        };

        fetchInitialMessages();
        return () => unsubscribeMessagesRef.current?.();
    }, [selectedConversation]);

    // Charger plus de messages (Pagination)
    const handleLoadMore = async () => {
        if (!selectedConversation || loadingMore || !hasMore) return;

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
    };

    const handleSelectConversation = (id: string) => {
        if (id === selectedConversation) return;
        setMessages([]); 
        setSelectedConversation(id);
    };

    const handleSendMessage = async (message: string, files?: File[]) => {
        if (!selectedConversation || (!message.trim() && (!files || files.length === 0))) return;
        try {
            setSending(true);
            const messageId = await sendMessage(selectedConversation, message);
            if (files && files.length > 0) {
                for (const file of files) await uploadChatFile(file, messageId);
            }
        } catch (error) {
            toast({ title: "Erreur", description: "Impossible d'envoyer.", variant: "destructive" });
        } finally { setSending(false); }
    };

    const handleCloseConversation = async () => {
        if (!selectedConversation) return;
        try {
            await closeConversation(selectedConversation);
            toast({ title: "Fermé", description: "Discussion classée." });
            loadConversations(false);
            setSelectedConversation(null);
        } catch (error) {
            toast({ title: "Erreur", description: "Action impossible.", variant: "destructive" });
        }
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
        <div className="fixed inset-0 top-[64px] left-0 md:left-[280px] bg-[#0b141a] z-0 flex overflow-hidden">
            {/* Sidebar WhatsApp Style */}
            <div className="w-full md:w-80 lg:w-[400px] flex flex-col bg-[#111b21] border-r border-[#222d34] z-20 flex-shrink-0">
                {/* Header Sidebar */}
                <div className="h-[60px] flex-shrink-0 bg-[#202c33] px-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MessageCircle className="text-[#00a884] h-6 w-6" />
                        <h1 className="font-bold text-[#e9edef] text-lg">Support</h1>
                    </div>
                    <div className="flex gap-1 text-[#aebac1]">
                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-[#374248]"><Archive className="h-5 w-5" /></Button>
                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-[#374248]"><MoreVertical className="h-5 w-5" /></Button>
                    </div>
                </div>

                {/* Recherche & Filtres */}
                <div className="p-2 space-y-2 bg-[#111b21]">
                    <div className="relative bg-[#202c33] rounded-lg px-3 flex items-center h-9">
                        <Search className="h-4 w-4 text-[#8696a0] mr-3" />
                        <Input 
                            placeholder="Chercher un client" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-full border-0 bg-transparent focus-visible:ring-0 px-0 text-sm text-[#e9edef] placeholder:text-[#8696a0]"
                        />
                    </div>
                    <Tabs value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? undefined : v as 'open' | 'closed')}>
                        <TabsList className="grid w-full grid-cols-3 h-8 p-1 bg-[#202c33]">
                            <TabsTrigger value="all" className="text-[10px] uppercase font-bold text-[#aebac1] data-[state=active]:bg-[#374248] data-[state=active]:text-[#e9edef]">Tous</TabsTrigger>
                            <TabsTrigger value="open" className="text-[10px] uppercase font-bold text-[#aebac1] data-[state=active]:bg-[#374248] data-[state=active]:text-[#e9edef]">Ouverts</TabsTrigger>
                            <TabsTrigger value="closed" className="text-[10px] uppercase font-bold text-[#aebac1] data-[state=active]:bg-[#374248] data-[state=active]:text-[#e9edef]">Clos</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                {/* Liste des conversations */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-[#00a884]" /></div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="p-12 text-center text-[#8696a0] text-sm italic">Aucun message.</div>
                    ) : (
                        filteredConversations.map((conv) => (
                            <div
                                key={conv.id}
                                onClick={() => handleSelectConversation(conv.id)}
                                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-[#222d34]/30 hover:bg-[#202c33] ${
                                    selectedConversation === conv.id ? "bg-[#2a3942]" : ""
                                }`}
                            >
                                <Avatar className="h-12 w-12 border border-[#313d45]">
                                    <AvatarFallback className="bg-[#00a884]/10 text-[#00a884] font-bold">{conv.user_full_name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline">
                                        <h3 className="text-[15px] font-medium text-[#e9edef] truncate">{conv.user_full_name}</h3>
                                        <span className={`text-[11px] ${conv.admin_unread_count > 0 ? "text-[#00a884] font-bold" : "text-[#8696a0]"}`}>{formatDate(conv.last_message_at)}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-0.5">
                                        <p className="text-[13px] text-[#8696a0] truncate pr-4">{conv.last_message_preview || "..."}</p>
                                        {conv.admin_unread_count > 0 && (
                                            <Badge className="bg-[#00a884] text-[#111b21] rounded-full px-1.5 h-5 min-w-[20px] border-none font-bold text-[10px]">{conv.admin_unread_count}</Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Zone de Chat */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#0b141a] relative">
                {selectedConversation && selectedConvData ? (
                    <>
                        <div className="h-[60px] flex-shrink-0 bg-[#202c33] px-4 flex items-center justify-between border-b border-[#222d34] z-10 shadow-md">
                            <div className="flex items-center gap-3 min-w-0">
                                <Avatar className="h-10 w-10 border border-[#313d45]">
                                    <AvatarFallback className="bg-[#00a884]/10 text-[#00a884] font-bold">{selectedConvData.user_full_name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col truncate">
                                    <h2 className="text-[15px] font-medium text-[#e9edef] truncate">{selectedConvData.user_full_name}</h2>
                                    <span className="text-[11px] text-[#00a884] font-normal">Discussion active</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 text-[#aebac1]">
                                <Button variant="ghost" size="icon" onClick={handleCloseConversation} className="rounded-full hover:bg-[#374248]" title="Clôturer"><CheckCircle className="h-5 w-5" /></Button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden relative">
                            {loadingMessages && <div className="absolute inset-0 bg-[#0b141a]/50 flex items-center justify-center z-50"><Loader2 className="h-8 w-8 animate-spin text-[#00a884]" /></div>}
                            <ChatMessageList 
                                messages={messages} 
                                currentUserId={currentAdminId} 
                                onLoadMore={handleLoadMore}
                                hasMore={hasMore}
                                loadingMore={loadingMore}
                            />
                        </div>

                        <div className="bg-[#202c33]">
                            {selectedConvData.status === 'open' ? (
                                <ChatMessageInput onSend={handleSendMessage} disabled={sending} />
                            ) : (
                                <div className="p-4 text-center text-sm font-medium text-[#8696a0] bg-[#111b21]">
                                    Cette conversation est clôturée.
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-[#0b141a]">
                        <div className="w-64 h-64 bg-[#202c33] rounded-full flex items-center justify-center mb-8 shadow-inner">
                            <MessageCircle className="h-32 w-32 text-[#3b4a54]" />
                        </div>
                        <h2 className="text-3xl font-light text-[#e9edef] mb-2 tracking-tight">Support Nguma</h2>
                        <p className="text-[#8696a0] max-w-sm mt-4 text-sm leading-relaxed">Sélectionnez une discussion pour commencer.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
