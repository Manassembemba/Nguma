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
import { requestDeposit } from "@/services/walletService";
import { useToast } from "@/components/ui/use-toast";
import { z } from "zod";
import { CreditCard, Smartphone, Bitcoin, ArrowLeft } from "lucide-react";

const depositSchema = z.object({
  amount: z.coerce.number().positive("Le montant doit être positif."),
  reference: z.string().optional(),
  phone: z.string().optional(),
});

type Step = "select_method" | "enter_details";
type Method = "crypto" | "mobile_money" | "card";

export const DepositDialog = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select_method");
  const [method, setMethod] = useState<Method | null>(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: { amount: number; method: string; reference?: string; phone?: string }) => 
      requestDeposit(data.amount, data.method, data.reference, data.phone),
    onSuccess: () => {
      toast({
        title: "Demande de dépôt reçue",
        description: "Votre dépôt est en attente de validation par un administrateur.",
      });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
      setOpen(false);
      reset();
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  const reset = () => {
    setStep("select_method");
    setMethod(null);
    setAmount("");
    setReference("");
    setPhone("");
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!method) return;
    try {
      const validatedData = depositSchema.parse({ amount, reference, phone });
      mutation.mutate({ 
        amount: validatedData.amount, 
        method, 
        reference: validatedData.reference, 
        phone: validatedData.phone 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ variant: "destructive", title: "Erreur de validation", description: error.errors[0].message });
      }
    }
  };

  const renderMethodDetails = () => {
    switch (method) {
      case "crypto":
        return (
          <div className="text-center space-y-4 p-4 rounded-lg bg-muted/50">
            <p className="font-semibold">Envoyez vos USDT (TRC20) à l'adresse suivante :</p>
            <div className="p-2 rounded-md bg-background font-mono text-sm break-all">TFakeAddressForUSDTtrc20simulation12345</div>
            <div className="space-y-2 text-left pt-4">
              <Label htmlFor="reference">ID de Transaction (TxID)</Label>
              <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Collez l'ID de la transaction ici" required />
            </div>
          </div>
        );
      case "mobile_money":
        return (
          <div className="space-y-2">
            <Label htmlFor="phone">Votre numéro de téléphone</Label>
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ex: 0812345678" required />
            <p className="text-xs text-muted-foreground pt-2">Ce numéro sera utilisé pour vérifier votre paiement.</p>
          </div>
        );
      case "card":
        return (
          <div className="space-y-2">
            <Label>Informations de la carte</Label>
            <Input type="text" placeholder="Numéro de carte" />
            <div className="flex gap-2">
              <Input type="text" placeholder="MM/AA" />
              <Input type="text" placeholder="CVC" />
            </div>
            <p className="text-xs text-muted-foreground pt-2">Simulation uniquement. N'entrez pas de vraies informations.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) reset(); }}>
      <DialogTrigger asChild>
        <Button>Déposer</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            {step === 'enter_details' && (
              <Button variant="ghost" size="sm" className="absolute left-4 top-4 h-auto p-1" onClick={() => setStep("select_method")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>Effectuer un dépôt</DialogTitle>
            <DialogDescription>
              {step === 'select_method' ? "Choisissez une méthode de dépôt." : "Entrez le montant et les détails du dépôt."}
            </DialogDescription>
          </DialogHeader>
          
          {step === 'select_method' ? (
            <div className="grid gap-4 py-4">
              <Button variant="outline" className="justify-start h-14" onClick={() => { setMethod("crypto"); setStep("enter_details"); }}><Bitcoin className="mr-4" /> Crypto (USDT)</Button>
              <Button variant="outline" className="justify-start h-14" onClick={() => { setMethod("mobile_money"); setStep("enter_details"); }}><Smartphone className="mr-4" /> Mobile Money</Button>
              <Button variant="outline" className="justify-start h-14" onClick={() => { setMethod("card"); setStep("enter_details"); }}><CreditCard className="mr-4" /> Carte Bancaire</Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {renderMethodDetails()}
              <div className="space-y-2 pt-4">
                <Label htmlFor="amount">Montant du dépôt (USD)</Label>
                <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required disabled={mutation.isPending} />
              </div>
            </div>
          )}

          {step === 'enter_details' && (
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Demande en cours..." : "Confirmer la demande de dépôt"}</Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};