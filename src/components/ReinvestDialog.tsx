import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Info, BookOpen } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reinvestProfit } from "@/services/contractService";
import { getSettings } from "@/services/settingsService";
import { useToast } from "@/components/ui/use-toast";
import { z } from "zod";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type WalletData = Database['public']['Tables']['wallets']['Row'];

interface ReinvestDialogProps {
  wallet: WalletData | undefined;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export const ReinvestDialog = ({ wallet, open: propOpen, onOpenChange: propOnOpenChange, showTrigger = true }: ReinvestDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = propOpen !== undefined ? propOpen : internalOpen;
  const setOpen = propOnOpenChange !== undefined ? propOnOpenChange : setInternalOpen;
  const [amount, setAmount] = useState("");
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [isInsured, setIsInsured] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const maxReinvestment = Number(wallet?.profit_balance || 0);

  // Récupérer les paramètres d'assurance
  const insuranceEnabled = settings?.find(s => s.key === 'insurance_enabled')?.value === 'true';
  const insuranceFeePercent = parseFloat(settings?.find(s => s.key === 'insurance_fee_percent')?.value || '0');
  const insuranceFeeFixed = parseFloat(settings?.find(s => s.key === 'insurance_fee_fixed')?.value || '0');
  const insuranceApplyBoth = settings?.find(s => s.key === 'insurance_apply_both')?.value === 'true';
  const insuranceDurationMonths = settings?.find(s => s.key === 'insurance_duration_months')?.value || '10';
  const contractPdfUrl = settings?.find(s => s.key === 'contract_explanation_pdf_url')?.value;

  // Calculer les frais d'assurance
  const calculateInsuranceFee = (amt: number): number => {
    if (!isInsured || !insuranceEnabled) return 0;

    if (insuranceApplyBoth) {
      return (amt * insuranceFeePercent / 100) + insuranceFeeFixed;
    } else {
      if (insuranceFeePercent > 0) {
        return amt * insuranceFeePercent / 100;
      } else {
        return insuranceFeeFixed;
      }
    }
  };

  const amountValue = parseFloat(amount) || 0;
  const insuranceFee = calculateInsuranceFee(amountValue);
  const netAmount = amountValue - insuranceFee;

  const reinvestSchema = z.object({
    amount: z.coerce.number().positive("Le montant doit être positif.")
      .min(500, { message: "Le montant minimum pour réinvestir est de 500 USD." })
      .max(maxReinvestment, { message: `Le montant ne peut pas dépasser vos profits disponibles : ${maxReinvestment.toFixed(2)}` }),
  });

  const mutation = useMutation({
    mutationFn: ({ amount, isInsured }: { amount: number; isInsured: boolean }) =>
      reinvestProfit(amount, isInsured),
    onSuccess: (data) => {
      const response = data as { success: boolean; insurance_fee?: number; net_amount?: number };
      toast({
        title: "Succès",
        description: isInsured
          ? `Votre contrat de réinvestissement assuré a été créé. Montant du contrat: ${response.net_amount?.toFixed(2)} USD (Frais d'assurance: ${response.insurance_fee?.toFixed(2)} USD)`
          : "Réinvestissement réussi. Un nouveau contrat a été créé.",
      });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
      setOpen(false);
      setAmount("");
      setIsTermsAccepted(false);
      setIsInsured(false);
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTermsAccepted) {
      toast({ variant: "destructive", title: "Erreur", description: "Vous devez accepter les termes du contrat." });
      return;
    }
    try {
      const validatedData = reinvestSchema.parse({ amount });
      mutation.mutate({ amount: validatedData.amount, isInsured });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ variant: "destructive", title: "Erreur de validation", description: error.errors[0].message });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button variant="default">Réinvestir les Profits</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Réinvestir les Profits</DialogTitle>
            <DialogDescription>
              Veuillez lire et accepter les termes avant de créer un nouveau contrat avec vos profits. Minimum de réinvestissement : 500 USD.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="amount">Montant à réinvestir (USD)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Entrez le montant"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Profits disponibles: {maxReinvestment.toFixed(2)} USD
              </p>
            </div>

            {insuranceEnabled && (
              <div className={cn(
                "border-2 rounded-xl p-4 transition-all duration-300",
                isInsured 
                  ? "bg-indigo-50/50 border-indigo-200 dark:bg-indigo-900/10 dark:border-indigo-800 shadow-sm" 
                  : "bg-muted/30 border-transparent"
              )}>
                <div className="flex items-start space-x-3">
                  <div className="mt-1">
                    <Checkbox
                      id="insurance-reinvest"
                      className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                      checked={isInsured}
                      onCheckedChange={(checked) => setIsInsured(checked as boolean)}
                    />
                  </div>
                  <div className="grid gap-1.5 leading-none flex-1">
                    <label
                      htmlFor="insurance-reinvest"
                      className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <Shield className={cn("h-4 w-4", isInsured ? "text-indigo-600" : "text-zinc-400")} />
                        Assurance Capital
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                        {insuranceDurationMonths} mois
                      </span>
                    </label>
                    <div className="flex items-center gap-1">
                      <p className="text-xs text-muted-foreground">
                        Protection intégrale de votre capital initial.
                      </p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help opacity-70 hover:opacity-100" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs text-xs">
                              L'Assurance Capital vous protège pendant les {insuranceDurationMonths} premiers mois.
                              Elle garantit le remboursement de votre capital moins les bénéfices déjà perçus en cas de besoin.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>

                {isInsured && amountValue > 0 && (
                  <div className="mt-4 space-y-2 text-[11px] border-t border-indigo-100 dark:border-indigo-800/50 pt-3 animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className="flex justify-between items-center text-zinc-500 font-medium">
                      <span>Montant brut:</span>
                      <span>{amountValue.toFixed(2)} USD</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 font-medium">Frais de protection:</span>
                      <span className="font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded">
                        -{insuranceFee.toFixed(2)} USD
                        {insuranceFeePercent > 0 && ` (${insuranceFeePercent}%)`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 font-medium">Durée de couverture:</span>
                      <span className="font-bold text-indigo-600">{insuranceDurationMonths} mois</span>
                    </div>
                    <div className="border-t border-dashed border-indigo-200 dark:border-indigo-800 my-2 pt-2 flex justify-between items-center">
                      <span className="font-bold text-zinc-700 dark:text-zinc-300">Capital net investi:</span>
                      <span className="text-sm font-black text-emerald-600">{netAmount.toFixed(2)} USD</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {contractPdfUrl && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <BookOpen className="mr-2 h-4 w-4" />
                    LIRE LE CONTRAT
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl h-[90vh] p-2">
                  <iframe
                    src={`${contractPdfUrl}#toolbar=0`}
                    className="w-full h-full rounded-md"
                    title="Explication du Contrat PDF"
                  />
                </DialogContent>
              </Dialog>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="terms-reinvest"
                checked={isTermsAccepted}
                onCheckedChange={(checked) => setIsTermsAccepted(checked as boolean)}
              />
              <label
                htmlFor="terms-reinvest"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                J'ai lu et j'accepte les termes et conditions du contrat
              </label>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="submit" disabled={!isTermsAccepted || mutation.isPending || maxReinvestment === 0}>
              {mutation.isPending ? "Création en cours..." : "Réinvestir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
