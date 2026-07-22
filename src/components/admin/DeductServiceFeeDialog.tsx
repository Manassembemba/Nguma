import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminDeductServiceFee, getUserDetails } from "@/services/adminService";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";

interface DeductServiceFeeDialogProps {
  userId: string;
  userEmail: string;
}

export const DeductServiceFeeDialog = ({ userId, userEmail }: DeductServiceFeeDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  // Récupérer les détails de l'utilisateur pour la simulation
  const { data: userDetails } = useQuery({
    queryKey: ["userDetails", userId],
    queryFn: () => getUserDetails(userId),
    enabled: !!userId,
  });

  // Calcul de la simulation de répartition
  const simulation = useMemo(() => {
    if (!userDetails || !amount) return null;
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return null;

    const profitBalance = Number(userDetails.wallet?.profit_balance || 0);
    const contracts = userDetails.contracts || [];
    const totalCapital = contracts.reduce((sum: number, c: any) => sum + Number(c.amount), 0);

    if (numericAmount > (profitBalance + totalCapital)) {
      return { type: 'error', message: "Montant supérieur au solde total disponible." };
    }

    const fromProfit = Math.min(numericAmount, profitBalance);
    const fromCapital = Math.max(0, numericAmount - fromProfit);

    return {
      type: 'success',
      fromProfit,
      fromCapital
    };
  }, [userDetails, amount]);

  const mutation = useMutation({
    mutationFn: adminDeductServiceFee,
    onSuccess: () => {
      toast({ title: "Succès", description: `Le service a été facturé avec succès à ${userEmail}.` });
      queryClient.invalidateQueries({ queryKey: ["investorsList"] });
      queryClient.invalidateQueries({ queryKey: ["userDetails", userId] });
      setAmount("");
      setReason("");
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  const handleSubmit = () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({ variant: "destructive", title: "Erreur", description: "Veuillez entrer un montant valide et positif." });
      return;
    }
    if (!reason) {
      toast({ variant: "destructive", title: "Erreur", description: "Veuillez fournir une raison pour ce débit." });
      return;
    }
    mutation.mutate({ userId, amount: numericAmount, reason });
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Facturer un service interne</DialogTitle>
        <DialogDescription>
          Débit automatique pour {userEmail}. La répartition suivante sera appliquée :
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {/* Affichage des soldes actuels */}
        {userDetails && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-green-50 border border-green-100">
                <p className="text-muted-foreground">Profit dispo :</p>
                <p className="font-bold text-green-700">
                  {formatCurrency(Number(userDetails.wallet?.profit_balance || 0), userDetails.wallet?.currency)}
                </p>
              </div>
              <div className="p-2 rounded bg-purple-50 border border-purple-100">
                <p className="text-muted-foreground">Capital total :</p>
                <p className="font-bold text-purple-700">
                  {formatCurrency(
                    (userDetails.contracts || []).reduce((sum: number, c: any) => sum + Number(c.amount), 0),
                    userDetails.wallet?.currency
                  )}
                </p>
              </div>
            </div>
            
            {/* Liste détaillée des contrats */}
            <div className="text-xs space-y-1">
                <p className="font-semibold text-muted-foreground">Détail des contrats :</p>
                <div className="max-h-[150px] overflow-y-auto border rounded p-2 space-y-1">
                    {(userDetails.contracts || []).filter((c: any) => c.status !== 'closed').map((c: any) => {
                        const amount = Number(c.amount || 0);
                        const totalProfitPaid = Number(c.total_profit_paid || 0);
                        const monthsPaid = Number(c.months_paid || 0);
                        const durationMonths = Number(c.duration_months || 10);
                        const netCapital = Math.max(0, amount - totalProfitPaid);

                        // Calcul réaliste basé sur la performance réelle constatée
                        const monthlyProfit = monthsPaid > 0 ? (totalProfitPaid / monthsPaid) : 0;
                        const totalExpectedProfit = monthlyProfit * durationMonths;
                        const remainingProfit = Math.max(0, totalExpectedProfit - totalProfitPaid);

                        return (
                            <div key={c.id} className="flex justify-between items-center bg-muted/30 p-1.5 rounded text-[10px]">
                                <div className="truncate max-w-[120px]">
                                    <p className="font-semibold truncate">Contrat #{c.id.substring(0, 8)}</p>
                                    <p className="text-[9px] text-muted-foreground">Cap: {formatCurrency(amount, userDetails.wallet?.currency)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono font-medium">{formatCurrency(netCapital, userDetails.wallet?.currency)}</p>
                                    <p className="text-[9px] text-green-600">Restant: {formatCurrency(remainingProfit, userDetails.wallet?.currency)}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="amount">Montant (USD)</Label>
          <Input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="ex: 50.00"
          />
        </div>

        {simulation && (
          <div className="p-4 rounded-md bg-muted text-sm space-y-2">
            <p className="font-semibold">Répartition prévue :</p>
            {simulation.type === 'error' ? (
              <p className="text-red-600">{simulation.message}</p>
            ) : (
              <>
                <div className="flex justify-between">
                  <span>Prélèvement sur Profits :</span>
                  <span>{formatCurrency(simulation.fromProfit, userDetails?.wallet?.currency)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span>Prélèvement sur Capital :</span>
                  <span>{formatCurrency(simulation.fromCapital, userDetails?.wallet?.currency)}</span>
                </div>
              </>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="reason">Raison du service</Label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ex: Formation trading niveau 1"
          />
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Annuler</Button>
        </DialogClose>
        <Button 
            onClick={handleSubmit} 
            disabled={mutation.isPending || (simulation?.type === 'error')}
        >
          {mutation.isPending ? "Traitement..." : "Facturer le service"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
