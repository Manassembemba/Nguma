import { FileIcon, ImageIcon, FileTextIcon, DownloadIcon } from "lucide-react";
import { formatFileSize, isImageFile } from "@/services/fileUploadService";
import type { ChatAttachment } from "@/services/chatService";

interface FilePreviewProps {
    attachment: ChatAttachment;
    className?: string;
}

export function FilePreview({ attachment, className = "" }: FilePreviewProps) {
    const isImage = isImageFile(attachment.file_type);

    if (isImage) {
        return (
            <div className={`relative group ${className}`}>
                <img
                    src={attachment.file_url}
                    alt={attachment.file_name}
                    className="max-w-xs rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => window.open(attachment.file_url, '_blank')}
                    loading="lazy"
                />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                        href={attachment.file_url}
                        download={attachment.file_name}
                        className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <DownloadIcon className="h-4 w-4" />
                    </a>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    {attachment.file_name} • {formatFileSize(attachment.file_size)}
                </p>
            </div>
        );
    }

    // Pour les fichiers non-image
    const getFileIcon = () => {
        if (attachment.file_type.includes('pdf')) return <FileTextIcon className="h-5 w-5" />;
        return <FileIcon className="h-5 w-5" />;
    };

    return (
        <a
            href={attachment.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-accent transition-colors ${className}`}
        >
            <div className="flex-shrink-0 p-2 bg-muted rounded">
                {getFileIcon()}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.file_size)}
                </p>
            </div>
            <DownloadIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </a>
    );
}
