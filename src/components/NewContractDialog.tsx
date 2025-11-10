
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlusCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContract } from "@/services/contractService";
import { getWallet } from "@/services/walletService";
import { getSettings } from "@/services/settingsService"; // Import getSettings
import { useToast } from "@/components/ui/use-toast";
import { z } from "zod";

export const NewContractDialog = () => {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: getWallet,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const genericContractPdfUrl = settings?.find(s => s.key === 'generic_contract_pdf_url')?.value;

  useEffect(() => {
    if (wallet) {
      setAmount(String(wallet.total_balance || 0));
    }
  }, [wallet]);

  const contractSchema = z.object({
    amount: z.coerce.number().positive("Le montant doit être positif.")
      .max(Number(wallet?.total_balance) || 0, { message: "Le montant ne peut pas dépasser votre solde total." }),
  });

  const mutation = useMutation({
    mutationFn: createContract,
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Votre nouveau contrat a été créé avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
      setOpen(false);
      setAmount("");
      setIsTermsAccepted(false);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de créer le contrat.",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTermsAccepted) {
      toast({ variant: "destructive", title: "Erreur", description: "Vous devez accepter les termes du contrat." });
      return;
    }
    if (!genericContractPdfUrl) {
      toast({ variant: "destructive", title: "Erreur", description: "Le PDF du contrat générique n'est pas disponible. Veuillez contacter l'administrateur." });
      return;
    }
    try {
      const validatedData = contractSchema.parse({ amount });
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
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nouveau Contrat
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl md:max-w-5xl lg:max-w-6xl h-[90vh]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Créer un nouveau contrat</DialogTitle>
            <DialogDescription>
              Veuillez lire et accepter les termes du contrat avant d'investir.
            </DialogDescription>
          </DialogHeader>
          
          <div className="w-full rounded-md border my-4" style={{ height: 'calc(100% - 200px)' }}>
            {genericContractPdfUrl ? (
              <iframe 
                src={`${genericContractPdfUrl}#toolbar=0`} 
                width="100%" 
                height="100%" 
                style={{ border: "none" }}
                title="Termes du Contrat"
              ></iframe>
            ) : (
              <p className="text-muted-foreground text-center p-4">Les termes du contrat ne sont pas disponibles pour le moment.</p>
            )}
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              Montant (USD)
            </Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              className="col-span-3"
              placeholder="Ex: 5000"
              required
              readOnly // Champ en lecture seule
              disabled={mutation.isPending}
            />
          </div>

          <div className="flex items-center space-x-2 mt-4">
            <Checkbox id="terms" checked={isTermsAccepted} onCheckedChange={(checked) => setIsTermsAccepted(checked as boolean)} />
            <label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              J'ai lu et j'accepte les termes du contrat
            </label>
          </div>

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={!isTermsAccepted || mutation.isPending}>
              {mutation.isPending ? "Création en cours..." : "Créer le contrat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
