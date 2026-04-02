import { useState, KeyboardEvent, useRef, ChangeEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, X, Smile, Mic } from "lucide-react";

interface ChatMessageInputProps {
    onSend: (message: string, files?: File[]) => void;
    onTyping?: (isTyping: boolean) => void;
    disabled?: boolean;
    aiOnlyMode?: boolean;
}

export function ChatMessageInput({ onSend, onTyping, disabled, aiOnlyMode = false }: ChatMessageInputProps) {
    const [message, setMessage] = useState("");
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!onTyping) return;
        if (message.length > 0) {
            onTyping(true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => onTyping(false), 2000);
        } else {
            onTyping(false);
        }
        return () => { if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); };
    }, [message, onTyping]);

    const handleSend = () => {
        if ((!message.trim() && selectedFiles.length === 0) || disabled || aiOnlyMode) return;
        
        const dangerousPatterns = [/<script/i, /javascript:/i, /on\w+=/i, /<iframe/i];
        if (dangerousPatterns.some(p => p.test(message))) {
            alert("Sécurité : Le contenu de ce message n'est pas autorisé.");
            return;
        }

        onSend(message, selectedFiles);
        setMessage("");
        setSelectedFiles([]);
        if (onTyping) onTyping(false);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setSelectedFiles(prev => [...prev, ...files]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="bg-[#202c33] px-4 py-2.5 flex flex-col gap-2 border-t border-[#222d34]">
            {selectedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-1 animate-in slide-in-from-bottom-2">
                    {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 px-2 py-1 bg-[#2a3942] rounded-md border border-[#313d45] text-xs text-[#e9edef] shadow-sm">
                            <Paperclip className="h-3 w-3 text-[#8696a0]" />
                            <span className="truncate max-w-[100px]">{file.name}</span>
                            <button onClick={() => removeFile(index)} className="text-[#8696a0] hover:text-[#f15c5c]">
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-end gap-2">
                <div className="flex gap-0.5 pb-0.5">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-[#aebac1] hover:bg-[#374248] rounded-full h-10 w-10"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Paperclip className="h-6.5 w-6.5" />
                    </Button>
                </div>

                <div className="flex-1 bg-[#2a3942] rounded-lg min-h-[42px] max-h-[150px] flex items-center px-3 transition-all">
                    <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={aiOnlyMode ? "Sélectionnez une suggestion" : "Taper un message"}
                        className="flex-1 bg-transparent border-0 focus-visible:ring-0 resize-none py-2.5 text-[#e9edef] text-[15px] placeholder:text-[#8696a0] min-h-[42px] max-h-[150px] custom-scrollbar"
                        disabled={disabled || aiOnlyMode}
                    />
                </div>

                <div className="pb-0.5">
                    {(!message.trim() && selectedFiles.length === 0) ? (
                        <Button variant="ghost" size="icon" className="text-[#aebac1] hover:bg-[#374248] rounded-full h-10 w-10">
                            <Mic className="h-6.5 w-6.5" />
                        </Button>
                    ) : (
                        <Button 
                            onClick={handleSend}
                            disabled={disabled || aiOnlyMode}
                            className="bg-[#00a884] hover:bg-[#008f6a] text-[#111b21] rounded-full h-11 w-11 shadow-md flex-shrink-0 transition-all active:scale-95"
                        >
                            <Send className="h-5 w-5 ml-0.5" />
                        </Button>
                    )}
                </div>
            </div>

            <input ref={fileInputRef} type="file" className="hidden" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={handleFileChange} />
        </div>
    );
}
