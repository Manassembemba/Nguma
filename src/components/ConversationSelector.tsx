import { useState } from "react";
import { Plus, ChevronDown, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChatConversation } from "@/services/chatService";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ConversationSelectorProps {
    conversations: ChatConversation[];
    currentConversationId: string | null;
    onSelect: (conversationId: string) => void;
    onNew: () => void;
    loading?: boolean;
}

export function ConversationSelector({
    conversations,
    currentConversationId,
    onSelect,
    onNew,
    loading = false
}: ConversationSelectorProps) {
    const currentConversation = conversations.find(c => c.id === currentConversationId);

    const getConversationTitle = (conv: ChatConversation) => {
        if (conv.title) return conv.title;
        if (conv.subject && conv.subject !== 'Conversation de support') return conv.subject;
        return `Conversation du ${format(new Date(conv.created_at), 'dd MMM', { locale: fr })}`;
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    className="w-full justify-between"
                    disabled={loading}
                >
                    <div className="flex items-center gap-2 truncate">
                        <MessageSquare className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">
                            {currentConversation
                                ? getConversationTitle(currentConversation)
                                : 'Sélectionner une conversation'}
                        </span>
                    </div>
                    <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-80" align="start">
                <DropdownMenuItem onClick={onNew} className="cursor-pointer">
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="font-medium">Nouvelle conversation</span>
                </DropdownMenuItem>

                {conversations.length > 0 && <DropdownMenuSeparator />}

                <div className="max-h-[300px] overflow-y-auto">
                    {conversations.map((conv) => (
                        <DropdownMenuItem
                            key={conv.id}
                            onClick={() => onSelect(conv.id)}
                            className={`cursor-pointer ${conv.id === currentConversationId ? 'bg-accent' : ''}`}
                        >
                            <div className="flex flex-col gap-1 w-full">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium truncate flex-1">
                                        {getConversationTitle(conv)}
                                    </span>
                                    {conv.user_unread_count > 0 && (
                                        <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
                                            {conv.user_unread_count}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>{format(new Date(conv.created_at), 'dd MMM yyyy', { locale: fr })}</span>
                                    {conv.status === 'closed' && (
                                        <span className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Fermée</span>
                                    )}
                                    {conv.is_active && (
                                        <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded text-[10px]">
                                            Active
                                        </span>
                                    )}
                                </div>
                            </div>
                        </DropdownMenuItem>
                    ))}
                </div>

                {conversations.length === 0 && (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                        Aucune conversation. Créez-en une nouvelle !
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
