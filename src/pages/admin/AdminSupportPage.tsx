import { useState, useEffect, useRef } from "react";
import { 
    X, Search, MoreVertical, MessageCircle, CheckCircle, Loader2,
    Archive, Trash2, History, Bot, User, Power, Sparkles, LayoutPanelLeft
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
    subscribeToConversations,
    toggleAiSupport
} from "@/services/chatService";
import type { AdminConversation, ChatMessage } from "@/services/chatService";
import { uploadChatFile } from "@/services/fileUploadService";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { 
    Sheet, 
    SheetContent, 
    SheetHeader, 
    SheetTitle, 
    SheetTrigger 
} from "@/components/ui/sheet";

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
    const [isAiEnabled, setIsAiEnabled] = useState(true);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
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

        // On récupère le statut IA de la conversation
        const fetchAiStatus = async () => {
            const { data } = await supabase
                .from('chat_conversations')
                .select('is_ai_enabled')
                .eq('id', selectedConversation)
                .single();
            if (data) setIsAiEnabled(data.is_ai_enabled);
        };
        fetchAiStatus();

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
        setIsHistoryOpen(false);
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

    const handleToggleAi = async () => {
        if (!selectedConversation) return;
        try {
            const newState = !isAiEnabled;
            await toggleAiSupport(selectedConversation, newState);
            setIsAiEnabled(newState);
            toast({ 
                title: newState ? "IA Activée" : "Mode Humain", 
                description: newState ? "Monsieur Nguma reprend la main." : "Vous avez maintenant le contrôle total."
            });
        } catch (error) {
            toast({ title: "Erreur", description: "Action impossible.", variant: "destructive" });
        }
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

    // Composant de liste pour réutilisation
    const ConversationList = () => (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-[#00a884]" /></div>
            ) : filteredConversations.length === 0 ? (
                <div className="p-12 text-center text-[#8696a0] text-sm italic">Aucune discussion.</div>
            ) : (
                filteredConversations.map((conv) => (
                    <div
                        key={conv.id}
                        onClick={() => handleSelectConversation(conv.id)}
                        className={`flex items-center gap-4 px-6 py-4 cursor-pointer transition-all border-b border-white/5 hover:bg-[#202c33] ${
                            selectedConversation === conv.id ? "bg-[#2a3942] border-l-4 border-l-[#00a884]" : ""
                        }`}
                    >
                        <Avatar className="h-12 w-12 border-2 border-white/5 shadow-lg">
                            <AvatarFallback className="bg-gradient-to-br from-[#313d45] to-[#2a3942] text-[#e9edef] font-black text-sm uppercase">{conv.user_full_name.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-0.5">
                                <h3 className="text-[15px] font-black text-[#e9edef] truncate tracking-tight">{conv.user_full_name}</h3>
                                <span className={`text-[10px] font-bold ${conv.admin_unread_count > 0 ? "text-[#00a884]" : "text-[#8696a0]"}`}>{formatDate(conv.last_message_at)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <p className="text-[13px] text-[#8696a0] truncate font-medium pr-4">{conv.last_message_preview || "..."}</p>
                                {conv.admin_unread_count > 0 && (
                                    <Badge className="bg-[#00a884] text-[#111b21] rounded-full px-1.5 h-5 min-w-[20px] border-none font-black text-[10px] shadow-[0_0_10px_rgba(0,168,132,0.3)]">{conv.admin_unread_count}</Badge>
                                )}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 top-[64px] left-0 md:left-[280px] bg-[#0b141a] z-0 flex overflow-hidden h-[calc(100vh-64px)]">
            {/* Sidebar (Desktop fixe) */}
            <div className="hidden lg:flex w-[400px] flex-col bg-[#111b21] border-r border-white/5 flex-shrink-0">
                <div className="h-16 flex-shrink-0 bg-[#202c33] px-6 flex items-center justify-between border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <MessageCircle className="text-[#00a884] h-6 w-6" />
                        <h1 className="font-black text-[#e9edef] text-lg tracking-tight uppercase">Support</h1>
                    </div>
                </div>
                <div className="p-4 space-y-3 bg-[#111b21]">
                    <div className="relative bg-[#202c33] rounded-xl px-4 flex items-center h-10 border border-white/5 focus-within:border-[#00a884]/50 transition-all">
                        <Search className="h-4 w-4 text-[#8696a0] mr-3" />
                        <Input 
                            placeholder="Chercher un client..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-full border-0 bg-transparent focus-visible:ring-0 px-0 text-sm text-[#e9edef] placeholder:text-[#8696a0]"
                        />
                    </div>
                    <Tabs value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? undefined : v as 'open' | 'closed')}>
                        <TabsList className="grid w-full grid-cols-3 h-9 p-1 bg-[#202c33] rounded-xl border border-white/5">
                            <TabsTrigger value="all" className="text-[10px] uppercase font-black tracking-widest data-[state=active]:bg-[#00a884] data-[state=active]:text-[#111b21] rounded-lg">Tous</TabsTrigger>
                            <TabsTrigger value="open" className="text-[10px] uppercase font-black tracking-widest data-[state=active]:bg-[#00a884] data-[state=active]:text-[#111b21] rounded-lg">Ouverts</TabsTrigger>
                            <TabsTrigger value="closed" className="text-[10px] uppercase font-black tracking-widest data-[state=active]:bg-[#00a884] data-[state=active]:text-[#111b21] rounded-lg">Clos</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
                <ConversationList />
            </div>

            {/* Zone de Chat */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#0b141a] relative h-full">
                {selectedConversation && selectedConvData ? (
                    <>
                        <div className="h-20 flex-shrink-0 bg-[#202c33]/90 backdrop-blur-xl px-6 lg:px-8 flex items-center justify-between border-b border-white/5 z-30 shadow-2xl sticky top-0">
                            <div className="flex items-center gap-4 min-w-0">
                                {/* Bouton Tiroir pour Mobile/Tablet */}
                                <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                                    <SheetTrigger asChild>
                                        <Button variant="ghost" size="icon" className="lg:hidden text-[#aebac1] hover:bg-white/5 rounded-xl h-10 w-10">
                                            <LayoutPanelLeft className="h-6 w-6" />
                                        </Button>
                                    </SheetTrigger>
                                    <SheetContent side="left" className="p-0 w-80 bg-[#111b21] border-r border-white/5">
                                        <div className="h-full flex flex-col">
                                            <SheetHeader className="p-6 border-b border-white/5 bg-[#202c33]/50 text-left">
                                                <SheetTitle className="text-[#e9edef] flex items-center gap-2">
                                                    <History className="h-5 w-5 text-[#00a884]" /> Historique
                                                </SheetTitle>
                                            </SheetHeader>
                                            <ConversationList />
                                        </div>
                                    </SheetContent>
                                </Sheet>

                                <Avatar className="h-11 w-11 border-2 border-[#00a884]/30 shadow-xl ring-4 ring-[#00a884]/5">
                                    <AvatarFallback className="bg-gradient-to-br from-[#00a884] to-[#005c4b] text-white font-black">{selectedConvData.user_full_name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col truncate">
                                    <h2 className="text-[16px] font-black text-[#e9edef] truncate tracking-tight uppercase">{selectedConvData.user_full_name}</h2>
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-[#00a884] animate-pulse" />
                                        <span className="text-[10px] text-[#00a884] font-black uppercase tracking-[0.1em]">Client en ligne</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-300 ${
                                    isAiEnabled 
                                        ? 'bg-[#00a884]/10 border-[#00a884]/30 text-[#00a884]' 
                                        : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                                }`}>
                                    {isAiEnabled ? <Bot className="h-4 w-4 animate-bounce" /> : <User className="h-4 w-4" />}
                                    <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">{isAiEnabled ? "IA Active" : "Humain"}</span>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={handleToggleAi}
                                        className={`h-7 w-7 rounded-lg transition-all ${isAiEnabled ? 'hover:bg-[#00a884]/20' : 'hover:bg-amber-500/20'}`}
                                    >
                                        <Power className={`h-3.5 w-3.5 ${isAiEnabled ? 'text-[#00a884]' : 'text-amber-500'}`} />
                                    </Button>
                                </div>
                                <Button variant="ghost" size="icon" onClick={handleCloseConversation} className="rounded-xl h-10 w-10 text-[#aebac1] hover:bg-emerald-500/20 hover:text-emerald-400">
                                    <CheckCircle className="h-6 w-6" />
                                </Button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden relative group/messages">
                            {loadingMessages && <div className="absolute inset-0 bg-[#0b141a]/80 backdrop-blur-sm flex items-center justify-center z-50"><Loader2 className="h-10 w-10 animate-spin text-[#00a884]" /></div>}
                            <ChatMessageList 
                                messages={messages} 
                                currentUserId={currentAdminId} 
                                onLoadMore={handleLoadMore}
                                hasMore={hasMore}
                                loadingMore={loadingMore}
                            />
                        </div>

                        <div className="bg-[#202c33]/50 backdrop-blur-xl border-t border-white/5 p-4 lg:p-6 flex-shrink-0">
                            {selectedConvData.status === 'open' ? (
                                <ChatMessageInput onSend={handleSendMessage} disabled={sending} />
                            ) : (
                                <div className="p-4 text-center rounded-2xl bg-[#111b21] border border-white/5 shadow-inner">
                                    <p className="text-sm font-black text-[#8696a0] uppercase tracking-widest flex items-center justify-center gap-2">
                                        <Archive className="h-4 w-4" /> Discussion clôturée
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-gradient-to-b from-[#0b141a] to-[#111b21]">
                        <div className="w-64 h-64 bg-[#202c33]/50 rounded-[3rem] flex items-center justify-center mb-8 shadow-inner border border-white/5 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#00a884]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                            <MessageCircle className="h-32 w-32 text-[#3b4a54] group-hover:scale-110 group-hover:text-[#00a884]/40 transition-all duration-700" />
                        </div>
                        <h2 className="text-4xl font-black text-[#e9edef] mb-4 tracking-tighter uppercase italic text-center">Nguma Control</h2>
                        <p className="text-[#8696a0] max-w-sm text-sm font-medium leading-relaxed opacity-70">
                            Sélectionnez une discussion à gauche pour prendre le relais de l'IA ou assister vos clients en direct.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
