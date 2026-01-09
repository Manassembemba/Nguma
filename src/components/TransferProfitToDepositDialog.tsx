import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, ArrowRightLeft } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { transferProfitToDeposit } from "@/services/walletService";
import { useToast } from "@/components/ui/use-toast";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

type WalletData = Database['public']['Tables']['wallets']['Row'];

interface TransferProfitToDepositDialogProps {
    wallet: WalletData | undefined;
}

export const TransferProfitToDepositDialog = ({ wallet }: TransferProfitToDepositDialogProps) => {
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState("");
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const maxTransfer = Number(wallet?.profit_balance || 0);

    const transferSchema = z.object({
        amount: z.coerce.number().positive("Le montant doit être positif.")
            .max(maxTransfer, { message: `Le montant ne peut pas dépasser vos profits disponibles : ${maxTransfer.toFixed(2)}` }),
    });

    const mutation = useMutation({
        mutationFn: (amount: number) => transferProfitToDeposit(amount),
        onSuccess: () => {
            toast({
                title: "Transfert Réussi",
                description: "Vos profits ont été transférés vers votre balance de dépôt.",
            });
            queryClient.invalidateQueries({ queryKey: ['wallet'] });
            queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
            setOpen(false);
            setAmount("");
        },
        onError: (error) => {
            toast({ variant: "destructive", title: "Erreur", description: error.message });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const validatedData = transferSchema.parse({ amount });
            mutation.mutate(validatedData.amount);
        } catch (error) {
            if (error instanceof z.ZodError) {
                toast({ variant: "destructive", title: "Erreur de validation", description: error.errors[0].message });
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4" />
                    Transférer
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-green-600" />
                            Transférer les Profits
                        </DialogTitle>
                        <DialogDescription>
                            Transférez vos profits vers votre balance de dépôt pour renforcer votre capital d'investissement.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 mt-4">
                        <div>
                            <Label htmlFor="transfer-amount">Montant à transférer (USD)</Label>
                            <Input
                                id="transfer-amount"
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="mt-1"
                            />
                            <div className="flex justify-between items-center mt-1">
                                <p className="text-xs text-muted-foreground">
                                    Profits disponibles: {maxTransfer.toFixed(2)} USD
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setAmount(maxTransfer.toString())}
                                    className="text-xs text-primary hover:underline font-medium"
                                >
                                    Tout transférer
                                </button>
                            </div>
                        </div>

                        <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                            <p>Note: Ce transfert est instantané et permettra d'utiliser ces fonds pour de nouveaux contrats.</p>
                        </div>
                    </div>

                    <DialogFooter className="mt-6">
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={mutation.isPending || maxTransfer <= 0 || !amount}
                        >
                            {mutation.isPending ? "Transfert en cours..." : "Confirmer le transfert"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
