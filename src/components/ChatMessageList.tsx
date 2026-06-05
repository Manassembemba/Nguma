import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage } from "@/services/chatService";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCheck, Trash2, Loader2, History } from "lucide-react";
import { deleteChatMessage } from "@/services/chatService";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";

interface ChatMessageListProps {
    messages: ChatMessage[];
    onSuggestionClick?: (message: string) => void;
    isTyping?: boolean;
    currentUserId?: string;
    onLoadMore?: () => void;
    hasMore?: boolean;
    loadingMore?: boolean;
}

function formatMessage(text: string) {
    if (!text) return null;
    return text.split('\n').map((line, i) => (
        <span key={i} className="block min-h-[1.2em]">
            {line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={j} className="font-bold">{part.slice(2, -2)}</strong>;
                }
                return part;
            })}
        </span>
    ));
}

function DateSeparator({ date }: { date: Date }) {
    let label = format(date, 'd MMMM yyyy', { locale: fr });
    if (isToday(date)) label = "AUJOURD'HUI";
    else if (isYesterday(date)) label = "HIER";

    return (
        <div className="flex justify-center my-6 sticky top-2 z-10">
            <span className="px-3 py-1 rounded-lg bg-[#182229] text-[11px] font-medium text-[#8696a0] shadow-md uppercase tracking-widest border border-[#222d34]">
                {label}
            </span>
        </div>
    );
}

function MessageItem({
    message,
    isOwnMessage,
    isNextSameSender,
    isPrevSameSender,
    isAdminView
}: {
    message: ChatMessage;
    isOwnMessage: boolean;
    isNextSameSender: boolean;
    isPrevSameSender: boolean;
    isAdminView: boolean;
}) {
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!window.confirm("Supprimer ce message ?")) return;
        try {
            setIsDeleting(true);
            await deleteChatMessage(message.id);
            toast({ title: "Message supprimé" });
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className={`group flex w-full mb-1 ${isOwnMessage ? 'justify-end pl-4 md:pl-12' : 'justify-start pr-4 md:pr-12'} ${isNextSameSender ? 'mb-0.5' : 'mb-3'}`}>
            {isAdminView && !isDeleting && (
                <button
                    onClick={handleDelete}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity p-2 text-[#8696a0] hover:text-[#f15c5c] self-center ${isOwnMessage ? 'order-first' : 'order-last'}`}
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            )}

            {isDeleting && (
                <div className={`self-center ${isOwnMessage ? 'order-first' : 'order-last'}`}>
                    <Loader2 className="h-4 w-4 animate-spin text-[#8696a0]" />
                </div>
            )}

            <div className={`relative max-w-full px-2.5 py-1.5 shadow-sm transition-all duration-200 ${
                isOwnMessage
                    ? `bg-[#005c4b] text-[#e9edef] ${isPrevSameSender ? 'rounded-lg' : 'rounded-lg rounded-tr-none'}`
                    : `bg-[#202c33] text-[#e9edef] ${isPrevSameSender ? 'rounded-lg' : 'rounded-lg rounded-tl-none'}`
            }`}>
                {!isPrevSameSender && (
                    <div className={`absolute top-0 w-3 h-3 ${
                        isOwnMessage
                            ? '-right-2 bg-[#005c4b] [clip-path:polygon(0_0,0_100%,100%_0)]'
                            : '-left-2 bg-[#202c33] [clip-path:polygon(100%_0,0_0,100%_100%)]'
                    }`} />
                )}

                <div className="text-[14.5px] leading-relaxed break-words">
                    {formatMessage(message.message)}
                </div>

                <div className="flex justify-end items-center gap-1 mt-0.5 min-w-[65px]">
                    <span className="text-[10px] text-[#8696a0] font-medium uppercase">
                        {format(new Date(message.created_at), 'HH:mm')}
                    </span>
                    {isOwnMessage && (
                        <span className="flex">
                            <CheckCheck className={`h-3.5 w-3.5 ${message.read_at ? "text-[#53bdeb]" : "text-[#8696a0]"}`} />
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export function ChatMessageList({
    messages,
    onSuggestionClick,
    isTyping = false,
    currentUserId,
    onLoadMore,
    hasMore = false,
    loadingMore = false
}: ChatMessageListProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

    useEffect(() => {
        const checkRole = async () => {
            const { data } = await supabase.from('user_roles').select('role').eq('user_id', currentUserId).eq('role', 'admin').single();
            setIsAdmin(!!data);
        };
        if (currentUserId) checkRole();
    }, [currentUserId]);

    // Auto-scroll intelligent au bas de la liste
    useEffect(() => {
        if (shouldAutoScroll && scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages.length, isTyping, shouldAutoScroll]);

    // Détecter si l'utilisateur scrolle manuellement pour désactiver l'auto-scroll
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 150;
        setShouldAutoScroll(isAtBottom);
    };

    if (messages.length === 0 && !loadingMore) {
        return null;
    }

    return (
        <ScrollArea
            className="flex-1 bg-[#0b141a] relative h-full"
            onScrollCapture={handleScroll}
            viewportRef={viewportRef}
        >
            <div className="absolute inset-0 opacity-[0.4] pointer-events-none"
                 style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', filter: 'invert(1)' }}
            />

            <div className="flex flex-col px-4 py-6 relative z-10">
                {/* Pagination : Charger plus de messages */}
                {hasMore && (
                    <div className="flex justify-center mb-6">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onLoadMore}
                            disabled={loadingMore}
                            className="text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33] rounded-full px-4 text-xs h-8 gap-2 border border-[#222d34]"
                        >
                            {loadingMore ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <History className="h-3 w-3" />
                            )}
                            Charger les messages précédents
                        </Button>
                    </div>
                )}

                {messages.map((message, index) => {
                    const msgDate = new Date(message.created_at);
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;

                    const isFirstInDay = !prevMsg || !isSameDay(new Date(prevMsg.created_at), msgDate);
                    const isOwnMessage = message.sender_id === currentUserId;
                    const isPrevSameSender = prevMsg?.sender_id === message.sender_id && !isFirstInDay;
                    const isNextSameSender = nextMsg?.sender_id === message.sender_id && isSameDay(new Date(nextMsg.created_at), msgDate);

                    return (
                        <div key={message.id}>
                            {isFirstInDay && <DateSeparator date={msgDate} />}
                            <MessageItem
                                message={message}
                                isOwnMessage={isOwnMessage}
                                isNextSameSender={isNextSameSender}
                                isPrevSameSender={isPrevSameSender}
                                isAdminView={isAdmin}
                            />
                        </div>
                    );
                })}

                {isTyping && (
                    <div className="flex justify-start mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="relative bg-[#202c33] rounded-2xl rounded-tl-none px-4 py-3 flex gap-3 items-center shadow-lg border border-white/5">
                            <div className="absolute top-0 -left-2 bg-[#202c33] w-3 h-3 [clip-path:polygon(100%_0,0_0,100%_100%)] border-t border-white/5" />
                            <div className="flex gap-1.5 px-1">
                                <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce [animation-duration:0.8s]" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce [animation-duration:0.8s]" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce [animation-duration:0.8s]" style={{ animationDelay: '300ms' }}></span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[12px] text-[#e9edef] font-bold tracking-tight italic opacity-90">
                                    Monsieur Nguma est en train de réfléchir...
                                </span>
                                <span className="text-[9px] text-[#8696a0] font-medium uppercase tracking-widest mt-0.5">
                                    Réponse imminente
                                </span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={scrollRef} className="h-2" />
            </div>
        </ScrollArea>
    );
}
