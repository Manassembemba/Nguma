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
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/components/ui/use-toast";
import { AlertTriangle, Download, Clock, Sparkles, TrendingUp, Shield } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ContractData = Database['public']['Tables']['contracts']['Row'];

interface ContractCardProps {
  contract: ContractData;
  formatCurrency: (amount: number) => string;
}

export const ContractCard = ({ contract, formatCurrency }: ContractCardProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const progress = (contract.months_paid / contract.duration_months) * 100;
  const totalProfitPaid = Number(contract.total_profit_paid) || 0;
  const monthlyRate = Number(contract.monthly_rate) || 0;
  const totalEstimatedProfit = Number(contract.amount) * monthlyRate * contract.duration_months;

  // Calculate smart badges
  const contractAge = Math.floor((new Date().getTime() - new Date(contract.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const isNew = contractAge < 30;
  const roiPercent = (totalProfitPaid / Number(contract.amount)) * 100;
  const isProfitable = roiPercent > 10;
  const monthsRemaining = contract.duration_months - (contract.months_paid || 0);
  const isEndingSoon = monthsRemaining <= 2 && monthsRemaining > 0 && contract.status === 'active';

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'refunded': return 'destructive';
      case 'pending_refund': return 'outline'; // Added pending_refund status
      default: return 'outline';
    }
  };

  return (
    <Card className="shadow-sm border-border/50 flex flex-col relative overflow-hidden">
      {/* Status indicator */}
      {contract.status === 'active' && (
        <div className="absolute top-3 left-3 z-10">
          <div className="w-2 h-2 rounded-full bg-green-500" />
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <CardTitle className="text-base">Contrat #{contract.id.substring(0, 8)}</CardTitle>
            <div className="flex flex-wrap gap-1 mt-2">
              {isEndingSoon && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] py-0">
                  Bientôt terminé
                </Badge>
              )}
              {contract.is_insured && (
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] py-0">
                  <Shield className="h-3 w-3 mr-1" />
                  Assuré
                </Badge>
              )}
            </div>
          </div>
          <Badge variant={getStatusVariant(contract.status)} className="capitalize text-[10px] py-0">{contract.status}</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-grow space-y-4 pt-0">
        <div className="text-2xl font-bold">{formatCurrency(Number(contract.amount))}</div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Progression</span>
            <span className="font-medium">{contract.months_paid} / {contract.duration_months} mois</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Profits versés */}
        <div className="pt-2 border-t border-dashed">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground font-medium">Profits versés</span>
            <span className="font-bold text-green-600">
              +{formatCurrency(totalProfitPaid)}
            </span>
          </div>
        </div>

        <div className="text-[10px] text-muted-foreground space-y-0.5 opacity-70">
          <p>Début: {format(new Date(contract.start_date), "dd/MM/yyyy", { locale: fr })}</p>
          <p>Fin: {format(new Date(contract.end_date), "dd/MM/yyyy", { locale: fr })}</p>
        </div>
      </CardContent>
      <CardFooter className="absolute bottom-2 right-2 p-0 border-none bg-transparent flex gap-2">
        {contract.is_insured && ( // Only render if contract is insured
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-indigo-500 hover:bg-indigo-500/20"
                disabled={contract.status !== 'active'} // Disable if not active
              >
                <Shield className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assurance Capital</DialogTitle>
                <DialogDescription>
                  Vous avez souscrit à l’Assurance Capital pour ce contrat. Votre assurance est active dès le début du contrat et expire lorsque celui-ci génère un profit équivalent au montant de votre capital initial, soit après 5 mois de profit.

                </DialogDescription>
              </DialogHeader>
              <div className="my-4 space-y-2 text-sm">
                <div className="flex justify-between"><span>Début de l'assurance :</span> <span className="font-medium">{format(new Date(contract.start_date), "dd/MM/yyyy", { locale: fr })}</span></div>
                <div className="flex justify-between"><span>Fin de l'assurance :</span> <span className="font-medium">{format(new Date(new Date(contract.start_date).setMonth(new Date(contract.start_date).getMonth() + 5)), "dd/MM/yyyy", { locale: fr })}</span></div>
                <hr className="my-2 border-border" />
                {contract.is_insured && (
                  <div className={`p-2 rounded-lg mb-2 ${contract.months_paid < 5 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className={`flex items-center gap-2 font-medium ${contract.months_paid < 5 ? 'text-green-700' : 'text-red-700'}`}>
                      <Shield className="h-4 w-4" />
                      {contract.months_paid < 5 ? 'Votre assurance est toujours valide' : 'Votre assurance a expiré'}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter className="flex flex-col items-center gap-4 pt-4">
                <Button variant="secondary" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">Fermer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardFooter>
    </Card>
  );
};