import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refundContract } from "@/services/contractService";
import { useToast } from "@/components/ui/use-toast";
import { AlertTriangle } from "lucide-react";

type ContractData = Database['public']['Tables']['contracts']['Row'];

interface ContractCardProps {
  contract: ContractData;
  formatCurrency: (amount: number) => string;
}

export const ContractCard = ({ contract, formatCurrency }: ContractCardProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: refundContract,
    onSuccess: (data) => {
      toast({
        title: "Succès",
        description: `Remboursement de ${formatCurrency(data.refund_amount)} effectué.`,
      });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erreur de remboursement",
        description: error.message,
      });
    },
  });

  const handleRefund = () => {
    mutation.mutate(contract.id);
  };

  const progress = (contract.months_paid / contract.duration_months) * 100;
  const refundAmount = Math.max(0, Number(contract.amount) - Number(contract.total_profit_paid));

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'refunded': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <Card className="shadow-elegant border-border/50 flex flex-col bg-gradient-card relative">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">Contrat #{contract.id.substring(0, 8)}</CardTitle>
          <Badge variant={getStatusVariant(contract.status)} className="capitalize">{contract.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="text-3xl font-bold">{formatCurrency(Number(contract.amount))}</div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-muted-foreground">Progression</span>
            <span className="text-sm font-medium">{contract.months_paid} / {contract.duration_months} mois</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
        <div className="text-xs text-muted-foreground space-y-1 pt-2">
          <p>Début: {format(new Date(contract.start_date), "d MMMM yyyy", { locale: fr })}</p>
          <p>Fin: {format(new Date(contract.end_date), "d MMMM yyyy", { locale: fr })}</p>
        </div>
      </CardContent>
      <CardFooter className="absolute bottom-2 right-2 p-0 border-none bg-transparent">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-yellow-500 hover:bg-yellow-500/20" disabled={contract.status !== 'active' || contract.months_paid >= 5}>
              <AlertTriangle className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Demande de Remboursement Anticipé</DialogTitle>
              <DialogDescription>
                Veuillez vérifier le calcul ci-dessous avant de confirmer. Cette action est irréversible.
              </DialogDescription>
            </DialogHeader>
            <div className="my-4 space-y-2 text-sm">
              <div className="flex justify-between"><span>Montant investi :</span> <span className="font-medium">{formatCurrency(Number(contract.amount))}</span></div>
              <div className="flex justify-between"><span>Profits déjà versés :</span> <span className="font-medium text-destructive">- {formatCurrency(Number(contract.total_profit_paid))}</span></div>
              <hr className="my-2 border-border" />
              <div className="flex justify-between text-base"><strong>Montant qui sera remboursé :</strong> <strong className="text-primary">{formatCurrency(refundAmount)}</strong></div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
              <Button variant="destructive" onClick={handleRefund} disabled={mutation.isPending}>
                {mutation.isPending ? "Confirmation..." : "Confirmer le remboursement"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
};