import { useQuery } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { getTransactionMetadata } from "@/services/adminService";
import { Loader2, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface TransactionDetailsDialogProps {
    transactionId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const TransactionDetailsDialog = ({
    transactionId,
    open,
    onOpenChange,
}: TransactionDetailsDialogProps) => {
    const { data: metadata, isLoading } = useQuery({
        queryKey: ["transactionMetadata", transactionId],
        queryFn: () => (transactionId ? getTransactionMetadata(transactionId) : Promise.resolve([])),
        enabled: !!transactionId && open,
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Détails de la Transaction
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="max-h-[60vh] pr-4">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : metadata && metadata.length > 0 ? (
                        <div className="space-y-4">
                            <div className="text-sm text-muted-foreground mb-4">
                                Voici les informations supplémentaires fournies par l'utilisateur lors du dépôt.
                            </div>

                            <div className="grid gap-4">
                                {metadata.map((item: any) => (
                                    <div key={item.id} className="flex flex-col space-y-1 bg-muted/30 p-3 rounded-lg border">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            {item.field_label || item.field_key}
                                        </span>
                                        <span className="text-sm font-medium break-all">
                                            {item.field_value}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            Aucune information supplémentaire disponible pour cette transaction.
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};
