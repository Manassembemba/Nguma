import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/components/ui/use-toast";
import { Eye, EyeOff, Lock, Mail, ShieldCheck, ArrowRight, CheckCircle2, Loader2, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

const passwordSchema = z.object({
  password: z.string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]).{8,}$/, "Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.")
    .max(100),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas.",
  path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

type Step = 'initial' | 'otp' | 'password';

export function PasswordUpdateCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>('initial');
  const [otpCode, setOtpCode] = useState("");
  const { toast } = useToast();

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const sendOtpRequest = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Email non trouvé. Veuillez vous reconnecter.");

      const { data, error } = await supabase.rpc('request_password_reset_otp', {
        p_email: user.email
      });

      if (error) throw error;
      if (data && !(data as any).success) throw new Error((data as any).message);

      setCurrentStep('otp');
      toast({
        title: "Code de sécurité envoyé",
        description: "Vérifiez votre boîte mail pour obtenir votre code de validation à 6 chiffres.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur d'envoi",
        description: error.message || "Une erreur est survenue lors de l'envoi du code.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const validateOtpFormat = () => {
    if (otpCode.length === 6) {
      setCurrentStep('password');
      toast({
        title: "Identité vérifiée",
        description: "Vous pouvez maintenant définir votre nouveau mot de passe.",
      });
    } else {
      toast({ variant: "destructive", title: "Code invalide", description: "Veuillez entrer un code à 6 chiffres." });
    }
  };

  const onPasswordSubmit = async (values: PasswordFormValues) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Session expirée.");

      const { data, error } = await supabase.functions.invoke('reset-password-admin', {
        body: {
          email: user.email,
          code: otpCode,
          password: values.password,
        },
      });

      if (error) {
        let errorMessage = "Erreur lors de la mise à jour.";
        try {
          const errorBody = await error.context?.json();
          errorMessage = errorBody?.error || error.message;
        } catch (e) {}
        throw new Error(errorMessage);
      }

      if (data?.error) throw new Error(data.error);

      toast({
        title: "Succès !",
        description: "Votre mot de passe a été modifié avec succès.",
      });

      form.reset();
      setCurrentStep('initial');
      setOtpCode("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Échec de la modification",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const cardCls = "border-none shadow-premium bg-white dark:bg-zinc-950 rounded-[2rem] overflow-hidden";
  const inputCls = "rounded-xl h-11 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:ring-primary";

  return (
    <Card className={cardCls}>
      <CardHeader className="border-b border-zinc-100 dark:border-zinc-900">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold">Sécurité du Compte</CardTitle>
            <CardDescription>Mise à jour sécurisée du mot de passe</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {currentStep === 'initial' && (
          <div className="space-y-6 py-4 text-center animate-in fade-in zoom-in duration-500">
            <div className="mx-auto w-20 h-20 bg-primary/5 dark:bg-primary/10 rounded-full flex items-center justify-center mb-2 shadow-inner">
              <ShieldCheck className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="font-black text-xl tracking-tight">Vérification requise</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto font-medium">
                Pour modifier votre mot de passe, nous devons d'abord confirmer votre identité via un code envoyé par email.
              </p>
            </div>
            <Button 
              onClick={sendOtpRequest} 
              className="w-full sm:w-auto px-12 h-12 rounded-xl font-bold shadow-premium bg-primary hover:bg-primary/90" 
              disabled={isLoading}
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Envoi en cours...</>
              ) : (
                <><ArrowRight className="mr-2 w-4 h-4 font-black" /> Commencer la vérification</>
              )}
            </Button>
          </div>
        )}

        {currentStep === 'otp' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <div className="bg-amber-500/5 dark:bg-amber-500/10 p-4 rounded-2xl flex items-start gap-3 border border-amber-500/20">
              <Mail className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="text-sm font-black text-amber-800 dark:text-amber-400 uppercase tracking-tight">Code de sécurité envoyé</p>
                <p className="text-xs text-amber-700 dark:text-amber-500 mt-1 font-medium leading-relaxed">
                  Vérifiez votre boîte mail. Le code à 6 chiffres expire dans 10 minutes.
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Saisissez votre code</label>
              <Input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="text-center text-4xl tracking-[0.5em] font-black h-20 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:border-primary transition-all"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={validateOtpFormat} 
                className="flex-1 h-12 rounded-xl font-bold shadow-premium"
                disabled={isLoading || otpCode.length !== 6}
              >
                Vérifier le code
              </Button>
              <Button 
                variant="outline" 
                className="h-12 rounded-xl font-bold border-zinc-200 dark:border-zinc-800"
                onClick={() => setCurrentStep('initial')} 
                disabled={isLoading}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'password' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-bold">Identité vérifiée avec succès</span>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onPasswordSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Nouveau mot de passe</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className={inputCls}
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormDescription className="text-[10px] font-medium">Doit inclure une majuscule et un symbole.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Confirmer le mot de passe</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className={inputCls}
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground hover:bg-transparent"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button type="submit" className="flex-1 h-12 rounded-xl font-bold shadow-premium bg-primary hover:bg-primary/90" disabled={isLoading}>
                    {isLoading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mise à jour...</>
                    ) : "Définir le nouveau mot de passe"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="h-12 rounded-xl font-bold"
                    onClick={() => setCurrentStep('otp')} 
                    disabled={isLoading}
                  >
                    Retour
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
