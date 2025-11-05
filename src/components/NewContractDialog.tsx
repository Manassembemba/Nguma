
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
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Créer un nouveau contrat</DialogTitle>
            <DialogDescription>
              Veuillez lire et accepter les termes du contrat avant d'investir.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-72 w-full rounded-md border p-4 my-4">
            <h3 className="font-bold mb-2">📄 Contrat d’Investissement Black Rock</h3>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p><strong>Société :</strong> Botes Academy – Plateforme Black Rock</p>
              
              <p><strong>1️⃣ Objet du contrat :</strong> Le présent contrat lie l’investisseur à la société Botes Academy pour la gestion automatisée d’un placement financier basé sur des opérations de trading de l’indice Step Index.</p>
              
              <p><strong>2️⃣ Durée du contrat :</strong> Chaque contrat a une durée fixe de 10 mois. À l’expiration, le capital investi et les profits sont libérés sur le wallet NGUMA</p>
              
              <p><strong>3️⃣ Taux de rendement :</strong> Le taux de profit mensuel est fixé par l’administrateur. Les profits sont calculés chaque mois (Montant Investi × Taux Mensuel) et ajoutés au wallet.</p>
              
              <p><strong>4️⃣ Dépôt et capital investi :</strong> Le dépôt peut être effectué par crypto-monnaie ou crédit admin. Le montant minimal est déterminé par la plateforme.</p>
              
              <p><strong>5️⃣ Retraits et remboursement anticipé :</strong> Les profits générés sont retirables à tout moment. Un remboursement anticipé est possible selon la formule : Montant remboursé = Montant investi - Profits déjà reçus.</p>
              
              <p><strong>6️⃣ Multiplicité des contrats :</strong> L’investisseur peut souscrire à plusieurs contrats simultanément.</p>
              
              <p><strong>7️⃣ Sécurité et audit :</strong> Toutes les opérations sont enregistrées et auditables.</p>
              
              <p><strong>8️⃣ Responsabilités :</strong> La société ne garantit pas un profit au-delà du taux fixé. L’investisseur reconnaît les risques liés aux conditions de marché.</p>
              
              <p><strong>9️⃣ Clôture du contrat :</strong> À la fin des 10 mois, le contrat est clôturé. L’investisseur peut retirer ses fonds ou renouveler le contrat.</p>
              
              <p><strong>🔟 Acceptation :</strong> En cliquant sur “Créer le contrat”, l’investisseur déclare avoir lu, compris et accepté les termes du présent contrat.</p>
            </div>
          </ScrollArea>

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
