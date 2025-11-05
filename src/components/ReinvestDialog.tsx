
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reinvestProfit } from "@/services/contractService";
import { useToast } from "@/components/ui/use-toast";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

type WalletData = Database['public']['Tables']['wallets']['Row'];

interface ReinvestDialogProps {
  wallet: WalletData | undefined;
}

export const ReinvestDialog = ({ wallet }: ReinvestDialogProps) => {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const maxReinvestment = Number(wallet?.profit_balance || 0);

  const reinvestSchema = z.object({
    amount: z.coerce.number().positive("Le montant doit être positif.").max(maxReinvestment, `Le montant ne peut pas dépasser vos profits disponibles : ${maxReinvestment.toFixed(2)}`),
  });

  const mutation = useMutation({
    mutationFn: reinvestProfit,
    onSuccess: () => {
      toast({ title: "Succès", description: "Réinvestissement réussi. Un nouveau contrat a été créé." });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
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
      const validatedData = reinvestSchema.parse({ amount });
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
        <Button variant="outline">Réinvestir les Profits</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Réinvestir les Profits</DialogTitle>
            <DialogDescription>
              Créez un nouveau contrat en utilisant votre solde de profits. Maximum : {maxReinvestment.toFixed(2)} USD.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">Montant</Label>
              <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="col-span-3" required disabled={mutation.isPending} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending || maxReinvestment === 0}>{mutation.isPending ? "En cours..." : "Réinvestir"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
