import { format, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";
import { Search, Plus, CheckCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ChatConversation } from "@/services/chatService";

interface ConversationHistoryProps {
    conversations: ChatConversation[];
    activeConversationId: string | null;
    onSelectConversation: (id: string) => void;
    onNewConversation: () => void;
}

export function ConversationHistory({
    conversations,
    activeConversationId,
    onSelectConversation,
    onNewConversation
}: ConversationHistoryProps) {
    
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        if (isToday(date)) return format(date, "HH:mm");
        if (isYesterday(date)) return "Hier";
        return format(date, "dd/MM/yy");
    };

    return (
        <div className="flex flex-col h-full bg-[#111b21] border-r border-[#222d34]">
            {/* Sidebar Header */}
            <div className="p-3 bg-[#202c33] flex justify-between items-center">
                <Avatar className="h-10 w-10 border border-[#313d45]">
                    <AvatarFallback className="bg-[#6a7175] text-[#e9edef]">Me</AvatarFallback>
                </Avatar>
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={onNewConversation} className="rounded-full h-10 w-10 text-[#aebac1] hover:bg-[#374248]">
                        <Plus className="h-6 w-6" />
                    </Button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="p-2 bg-[#111b21]">
                <div className="relative flex items-center bg-[#202c33] rounded-lg px-3 py-1.5 transition-all">
                    <Search className="h-4 w-4 text-[#8696a0] mr-3" />
                    <Input 
                        placeholder="Rechercher une discussion" 
                        className="h-7 border-0 bg-transparent focus-visible:ring-0 px-0 text-sm text-[#e9edef] placeholder:text-[#8696a0]"
                    />
                </div>
            </div>

            {/* Discussions List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {conversations.length === 0 ? (
                    <div className="p-8 text-center">
                        <p className="text-sm text-[#8696a0] italic">Aucune discussion.</p>
                    </div>
                ) : (
                    conversations.map((conv) => (
                        <div
                            key={conv.id}
                            onClick={() => onSelectConversation(conv.id)}
                            className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors border-b border-[#222d34]/50 hover:bg-[#202c33] ${
                                activeConversationId === conv.id ? "bg-[#2a3942]" : ""
                            }`}
                        >
                            <Avatar className="h-12 w-12 border border-[#313d45]">
                                <AvatarFallback className="bg-[#00a884]/20 text-[#00a884] font-bold">
                                    {conv.subject?.charAt(0) || "S"}
                                </AvatarFallback>
                            </Avatar>
                            
                            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                <div className="flex justify-between items-baseline">
                                    <h3 className="text-[15px] font-medium text-[#e9edef] truncate pr-2">
                                        {conv.subject || "Support Nguma"}
                                    </h3>
                                    <span className={`text-[11px] ${conv.user_unread_count > 0 ? "text-[#00a884] font-bold" : "text-[#8696a0]"}`}>
                                        {formatDate(conv.last_message_at)}
                                    </span>
                                </div>
                                
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-1 flex-1 min-w-0">
                                        <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb] flex-shrink-0" />
                                        <p className="text-[13px] text-[#8696a0] truncate">
                                            {conv.last_message_preview || "Démarrer la discussion..."}
                                        </p>
                                    </div>
                                    
                                    {conv.user_unread_count > 0 && (
                                        <span className="bg-[#00a884] text-[#111b21] text-[11px] font-bold h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center">
                                            {conv.user_unread_count}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
