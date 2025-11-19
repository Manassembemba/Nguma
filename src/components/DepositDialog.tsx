import { useState, useMemo } from "react";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requestDeposit } from "@/services/walletService";
import { getSettingByKey } from "@/services/settingsService";
import { useToast } from "@/components/ui/use-toast";
import { z } from "zod";
import { CreditCard, Smartphone, Bitcoin, ArrowLeft, Loader2, Upload, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Step = "select_method" | "enter_details";
type Method = "crypto" | "mobile_money" | "card";

export const DepositDialog = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select_method");
  const [method, setMethod] = useState<Method | null>(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['settings', 'payment'],
    queryFn: async () => {
      const keys = [
        'payment_usdt_address',
        'payment_mobile_money_info',
        'payment_instructions_crypto',
        'payment_instructions_mobile'
      ];
      const results = await Promise.all(keys.map(key => getSettingByKey(key)));
      return {
        usdtAddress: results[0]?.value || "Adresse non configurée",
        mobileInfo: results[1]?.value || "Info non configurée",
        cryptoInstructions: results[2]?.value || "Envoyez le montant exact.",
        mobileInstructions: results[3]?.value || "Envoyez le montant au numéro indiqué."
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: minDepositSetting, isLoading: isLoadingMinDeposit } = useQuery({
    queryKey: ['settings', 'minimum_deposit_amount'],
    queryFn: () => getSettingByKey('minimum_deposit_amount'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const minDepositAmount = useMemo(() => {
    return minDepositSetting?.value ? Number(minDepositSetting.value) : 0;
  }, [minDepositSetting]);

  const depositSchema = useMemo(() => {
    return z.object({
      amount: z.coerce
        .number()
        .positive("Le montant doit être positif.")
        .min(minDepositAmount, `Le montant minimum du dépôt est de ${minDepositAmount} USD.`),
      reference: z.string().optional(),
      phone: z.string().optional(),
    });
  }, [minDepositAmount]);


  const mutation = useMutation({
    mutationFn: async (data: { amount: number; method: string; reference?: string; phone?: string }) => {
      let proofUrl = undefined;

      if (proofFile) {
        setIsUploading(true);
        const fileExt = proofFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('payment_proofs')
          .upload(filePath, proofFile);

        if (uploadError) {
          setIsUploading(false);
          throw new Error("Erreur lors de l'upload de la preuve : " + uploadError.message);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('payment_proofs')
          .getPublicUrl(filePath);

        proofUrl = publicUrl;
        setIsUploading(false);
      }

      return requestDeposit(data.amount, data.method, data.reference, data.phone, proofUrl);
    },
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
    setProofFile(null);
    setIsUploading(false);
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ description: "Copié dans le presse-papier" });
    setTimeout(() => setCopied(false), 2000);
  };

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
            <div className="space-y-2">
              <p className="font-semibold">Adresse USDT (TRC20)</p>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-background font-mono text-sm break-all flex-1 border">
                  {settings?.usdtAddress}
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(settings?.usdtAddress || "")}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{settings?.cryptoInstructions}</p>
            </div>

            <div className="space-y-2 text-left pt-4">
              <Label htmlFor="reference">ID de Transaction (TxID)</Label>
              <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Collez l'ID de la transaction ici" required />
            </div>

            <div className="space-y-2 text-left">
              <Label htmlFor="proof">Preuve de paiement (Capture d'écran)</Label>
              <Input
                id="proof"
                type="file"
                accept="image/*"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
            </div>
          </div>
        );
      case "mobile_money":
        return (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <p className="font-semibold text-center">Numéros de Dépôt</p>
              <p className="text-sm text-center font-mono">{settings?.mobileInfo}</p>
              <p className="text-xs text-center text-muted-foreground">{settings?.mobileInstructions}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Votre numéro de téléphone</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ex: 0812345678" required />
              <p className="text-xs text-muted-foreground">Ce numéro sera utilisé pour identifier votre paiement.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="proof">Preuve de paiement (Optionnel)</Label>
              <Input
                id="proof"
                type="file"
                accept="image/*"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
            </div>
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

  const descriptionText = () => {
    if (step === 'select_method') {
      return "Choisissez une méthode de dépôt.";
    }
    if (isLoadingMinDeposit) {
      return <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />;
    }
    if (minDepositAmount > 0) {
      return `Entrez le montant et les détails du dépôt. Minimum: ${minDepositAmount} USD.`;
    }
    return "Entrez le montant et les détails du dépôt.";
  }

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
              {descriptionText()}
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
                <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required disabled={mutation.isPending || isLoadingMinDeposit} />
              </div>
            </div>
          )}

          {step === 'enter_details' && (
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending || isLoadingMinDeposit || isUploading}>
                {isUploading ? "Upload de la preuve..." : mutation.isPending ? "Demande en cours..." : "Confirmer la demande de dépôt"}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};