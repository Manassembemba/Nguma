
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
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { requestWithdrawal } from "@/services/walletService";
import { getSettings } from "@/services/settingsService";
import { useToast } from "@/components/ui/use-toast";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

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

  // Load withdrawal settings
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const minWithdrawal = Number(settings?.find(s => s.key === 'min_withdrawal_amount')?.value || 10);
  const profitBalance = Number(wallet?.profit_balance || 0);
  const maxWithdrawalSetting = Number(settings?.find(s => s.key === 'max_withdrawal_amount')?.value || 10000);
  const maxWithdrawal = profitBalance > 0 ? Math.min(profitBalance, maxWithdrawalSetting) : maxWithdrawalSetting;
  const feePercent = Number(settings?.find(s => s.key === 'withdrawal_fee_percent')?.value || 2);
  const feeFixed = Number(settings?.find(s => s.key === 'withdrawal_fee_fixed')?.value || 1);

  // Calculate total fee
  const calculateFee = (amt: number) => {
    return (amt * feePercent / 100) + feeFixed;
  };

  // Check if user has sufficient balance
  const hasSufficientBalance = profitBalance >= minWithdrawal;

  const withdrawSchema = z.object({
    amount: z.coerce.number()
      .positive("Le montant doit être positif.")
      .min(minWithdrawal, `Le montant minimum est de ${minWithdrawal} USD.`)
      .max(maxWithdrawal, `Le montant ne peut pas dépasser ${maxWithdrawal.toFixed(2)} USD.`)
      .refine((val) => val <= profitBalance, {
        message: `Solde de profits insuffisant. Disponible : ${profitBalance.toFixed(2)} USD.`
      }),
    paymentMethod: z.enum(["crypto", "mobile_money"], { message: "Veuillez sélectionner un moyen de paiement." }),
    paymentDetails: z.string().min(1, "Les détails de paiement sont obligatoires.")
      .refine((val) => {
        if (paymentMethod === "crypto") {
          // USDT TRC20 address validation: starts with T, 34 characters
          return /^T[A-Za-z0-9]{33}$/.test(val);
        } else if (paymentMethod === "mobile_money") {
          // International phone number format
          return /^\+?[1-9]\d{1,14}$/.test(val);
        }
        return true;
      }, {
        message: paymentMethod === "crypto"
          ? "Adresse USDT TRC20 invalide (doit commencer par 'T' et contenir 34 caractères)."
          : "Numéro de téléphone invalide (format international requis, ex: +243812345678)."
      }),
  });

  // MFA State
  const [step, setStep] = useState<1 | 2>(1); // Step 1: Request OTP, Step 2: Verify OTP
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");

  // Step 1: Request OTP
  const requestOTPMutation = useMutation({
    mutationFn: async () => {
      const validatedData = withdrawSchema.parse({ amount, paymentMethod, paymentDetails });
      const { requestWithdrawalOTP } = await import("@/services/withdrawalMFAService");
      return requestWithdrawalOTP(validatedData.amount, validatedData.paymentMethod, validatedData.paymentDetails);
    },
    onSuccess: (data) => {
      setVerificationId(data.verification_id);
      setStep(2);
      toast({ title: "Code envoyé", description: "Un code de vérification a été envoyé à votre email." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  // Step 2: Verify OTP and process withdrawal
  const verifyOTPMutation = useMutation({
    mutationFn: async () => {
      if (!verificationId || !otpCode) throw new Error("Code de vérification manquant.");
      const { verifyAndWithdraw } = await import("@/services/withdrawalMFAService");
      return verifyAndWithdraw(verificationId, otpCode);
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Votre demande de retrait a été soumise et est en attente d'approbation." });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      setOpen(false);
      // Reset form
      setAmount("");
      setPaymentMethod("");
      setPaymentDetails("");
      setStep(1);
      setVerificationId(null);
      setOtpCode("");
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      requestOTPMutation.mutate();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ variant: "destructive", title: "Erreur de validation", description: error.errors[0].message });
      } else if (error instanceof Error) {
        toast({ variant: "destructive", title: "Erreur", description: error.message });
      }
    }
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyOTPMutation.mutate();
  };

  const handleBack = () => {
    setStep(1);
    setOtpCode("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Retirer</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        {step === 1 ? (
          <form onSubmit={handleStep1Submit}>
            <DialogHeader>
              <DialogTitle>Effectuer un retrait</DialogTitle>
              <DialogDescription>
                Montant disponible : {maxWithdrawal.toFixed(2)} USD (profits)<br />
                Limites : {minWithdrawal} USD - {maxWithdrawal.toFixed(2)} USD
              </DialogDescription>
            </DialogHeader>

            {!hasSufficientBalance && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <Info className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  <strong>Solde insuffisant</strong><br />
                  Votre solde de profits ({profitBalance.toFixed(2)} USD) est inférieur au montant minimum de retrait ({minWithdrawal} USD).
                </AlertDescription>
              </Alert>
            )}

            {amount && Number(amount) > 0 && hasSufficientBalance && (
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Frais de retrait : {calculateFee(Number(amount)).toFixed(2)} USD ({feePercent}% + {feeFixed} USD fixe)<br />
                  <strong>Vous recevrez : {(Number(amount) - calculateFee(Number(amount))).toFixed(2)} USD</strong>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">Montant</Label>
                <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="col-span-3" required disabled={requestOTPMutation.isPending} />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="paymentMethod" className="text-right">Moyen de paiement</Label>
                <Select onValueChange={(value: "crypto" | "mobile_money") => setPaymentMethod(value)} value={paymentMethod} disabled={requestOTPMutation.isPending}>
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
                    disabled={requestOTPMutation.isPending}
                    placeholder={paymentMethod === "crypto" ? "Ex: TRC20_ADDRESS_HERE" : "Ex: +243 812345678"}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={requestOTPMutation.isPending || !paymentMethod || !paymentDetails || !hasSufficientBalance}>
                {requestOTPMutation.isPending ? "Envoi en cours..." : "Recevoir le code de vérification"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleStep2Submit}>
            <DialogHeader>
              <DialogTitle>Vérification de retrait</DialogTitle>
              <DialogDescription>
                Un code de vérification a été envoyé à votre email. Veuillez le saisir ci-dessous pour confirmer votre retrait de {amount} USD.
              </DialogDescription>
            </DialogHeader>

            <Alert className="bg-yellow-50 border-yellow-200 my-4">
              <Info className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                Le code expire dans 10 minutes. Vérifiez votre boîte de réception et vos spams.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="otpCode" className="text-right">Code OTP</Label>
                <Input
                  id="otpCode"
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="col-span-3"
                  required
                  disabled={verifyOTPMutation.isPending}
                  placeholder="123456"
                  maxLength={6}
                />
              </div>
            </div>
            <DialogFooter className="flex justify-between">
              <Button type="button" variant="outline" onClick={handleBack} disabled={verifyOTPMutation.isPending}>
                Retour
              </Button>
              <Button type="submit" disabled={verifyOTPMutation.isPending || otpCode.length !== 6}>
                {verifyOTPMutation.isPending ? "Vérification..." : "Confirmer le retrait"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
