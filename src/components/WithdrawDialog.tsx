
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { requestWithdrawal } from "@/services/walletService";
import { useToast } from "@/components/ui/use-toast";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

type WalletData = Database['public']['Tables']['wallets']['Row'];

interface WithdrawDialogProps {
  wallet: WalletData | undefined;
}

export const WithdrawDialog = ({ wallet }: WithdrawDialogProps) => {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"crypto" | "mobile_money" | "">("");
  const [paymentDetails, setPaymentDetails] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const maxWithdrawal = Number(wallet?.profit_balance || 0);

  const withdrawSchema = z.object({
    amount: z.coerce.number().positive("Le montant doit être positif.").max(maxWithdrawal, `Le montant ne peut pas dépasser vos profits disponibles : ${maxWithdrawal.toFixed(2)}`),
    paymentMethod: z.enum(["crypto", "mobile_money"], { message: "Veuillez sélectionner un moyen de paiement." }),
    paymentDetails: z.string().min(1, "Les détails de paiement sont obligatoires."),
  });

  const mutation = useMutation({
    mutationFn: requestWithdrawal,
    onSuccess: () => {
      toast({ title: "Succès", description: "Votre demande de retrait a été soumise et est en attente d'approbation." });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      setOpen(false);
      setAmount("");
      setPaymentMethod("");
      setPaymentDetails("");
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validatedData = withdrawSchema.parse({ amount, paymentMethod, paymentDetails });
      mutation.mutate({
        amount: validatedData.amount,
        method: validatedData.paymentMethod,
        details: validatedData.paymentDetails,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ variant: "destructive", title: "Erreur de validation", description: error.errors[0].message });
      } else if (error instanceof Error) {
        toast({ variant: "destructive", title: "Erreur", description: error.message });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Retirer</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Effectuer un retrait</DialogTitle>
            <DialogDescription>
              Vous pouvez retirer jusqu'à {maxWithdrawal.toFixed(2)} (votre solde de profits).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">Montant</Label>
              <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="col-span-3" required disabled={mutation.isPending} />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="paymentMethod" className="text-right">Moyen de paiement</Label>
              <Select onValueChange={(value: "crypto" | "mobile_money") => setPaymentMethod(value)} value={paymentMethod} disabled={mutation.isPending}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Sélectionner un moyen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crypto">Crypto (USDT TRC20)</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMethod && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="paymentDetails" className="text-right">
                  {paymentMethod === "crypto" ? "Adresse USDT TRC20" : "Numéro Mobile Money"}
                </Label>
                <Input 
                  id="paymentDetails" 
                  value={paymentDetails} 
                  onChange={(e) => setPaymentDetails(e.target.value)} 
                  className="col-span-3" 
                  required 
                  disabled={mutation.isPending}
                  placeholder={paymentMethod === "crypto" ? "Ex: TRC20_ADDRESS_HERE" : "Ex: +243 812345678"}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending || !paymentMethod || !paymentDetails}>
              {mutation.isPending ? "En cours..." : "Confirmer le retrait"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
