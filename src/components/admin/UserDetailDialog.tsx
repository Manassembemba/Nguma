import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserDetails, creditUser } from "@/services/adminService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { z } from "zod";

// --- Credit User Dialog (Nested) ---
const creditSchema = z.object({
  amount: z.coerce.number().positive("Le montant doit être positif."),
  reason: z.string().min(3, "La raison doit faire au moins 3 caractères."),
});

const CreditUserDialog = ({ userId, onCreditSuccess }: { userId: string, onCreditSuccess: () => void }) => {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: creditUser,
    onSuccess: () => {
      toast({ title: "Succès", description: "Utilisateur crédité." });
      queryClient.invalidateQueries({ queryKey: ['userDetails', userId] });
      queryClient.invalidateQueries({ queryKey: ['investorsList'] });
      setOpen(false);
      onCreditSuccess();
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validated = creditSchema.parse({ amount, reason });
      mutation.mutate({ userId, amount: validated.amount, reason: validated.reason });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ variant: "destructive", title: "Erreur de validation", description: error.errors[0].message });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Créditer le Portefeuille</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Crédit Manuel</DialogTitle>
            <DialogDescription>Ajoutez des fonds au portefeuille de l'utilisateur.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Montant</Label>
              <Input id="amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} disabled={mutation.isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Raison</Label>
              <Input id="reason" value={reason} onChange={e => setReason(e.target.value)} disabled={mutation.isPending} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "En cours..." : "Confirmer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// --- Main User Detail Dialog ---
interface UserDetailDialogProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UserDetailDialog = ({ userId, open, onOpenChange }: UserDetailDialogProps) => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["userDetails", userId],
    queryFn: () => getUserDetails(userId!),
    enabled: !!userId,
  });

  const renderContent = () => {
    if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>;
    if (isError || !data) return <p>Impossible de charger les détails de l'utilisateur.</p>;

    const { profile, wallet, contracts, transactions } = data;

    return (
      <div className="space-y-6">
        <section>
          <h3 className="font-semibold mb-2">Portefeuille</h3>
          <div className="grid grid-cols-3 gap-4 text-center p-4 rounded-lg bg-muted/50">
            <div><p className="text-sm text-muted-foreground">Solde Total</p><p className="font-bold text-lg">{formatCurrency(Number(wallet.total_balance), wallet.currency)}</p></div>
            <div><p className="text-sm text-muted-foreground">Investi</p><p className="font-bold text-lg">{formatCurrency(Number(wallet.invested_balance), wallet.currency)}</p></div>
            <div><p className="text-sm text-muted-foreground">Profits</p><p className="font-bold text-lg">{formatCurrency(Number(wallet.profit_balance), wallet.currency)}</p></div>
          </div>
        </section>
        {/* Other sections remain the same... */}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{data?.profile?.full_name || data?.profile?.email || "Détails de l'utilisateur"}</DialogTitle>
          <DialogDescription>Vue d'ensemble du compte de l'utilisateur.</DialogDescription>
        </DialogHeader>
        {renderContent()}
        <DialogFooter className="mt-4 border-t pt-4">
          {userId && <CreditUserDialog userId={userId} onCreditSuccess={() => refetch()} />}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};