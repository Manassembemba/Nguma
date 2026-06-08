
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
import { Shield, TrendingUp, Calendar, ArrowRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/services/settingsService";

type ContractData = Database['public']['Tables']['contracts']['Row'];

interface ContractCardProps {
  contract: ContractData;
  formatCurrency: (amount: number) => string;
}

export const ContractCard = ({ contract, formatCurrency }: ContractCardProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  // Utiliser la durée stockée sur le contrat s'il est assuré, sinon fallback sur le paramètre global
  const insuranceDurationMonths = contract.is_insured && contract.insurance_duration_months 
    ? contract.insurance_duration_months 
    : parseInt(settings?.find(s => s.key === 'insurance_duration_months')?.value || '10');

  const progress = (contract.months_paid / contract.duration_months) * 100;
  const totalProfitPaid = Number(contract.total_profit_paid) || 0;

  const monthsRemaining = contract.duration_months - (contract.months_paid || 0);
  const isEndingSoon = monthsRemaining <= 2 && monthsRemaining > 0 && contract.status === 'active';

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active': return { label: 'Actif', class: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' };
      case 'completed': return { label: 'Terminé', class: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' };
      case 'refunded': return { label: 'Remboursé', class: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800' };
      case 'pending_refund': return { label: 'Remboursement en cours', class: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' };
      case 'paused': return { label: 'En Pause', class: 'bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700' };
      default: return { label: status, class: 'bg-zinc-50 text-zinc-700 border-zinc-200' };
    }
  };

  const statusConfig = getStatusConfig(contract.status);

  return (
    <Card className="group relative overflow-hidden border-none shadow-elegant transition-all duration-500 hover:shadow-premium hover:-translate-y-1">
      {/* Top Decorative bar */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1.5 transition-all duration-500",
        contract.status === 'active' ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
      )} />

      <CardHeader className="pb-4 pt-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Contrat</span>
              <span className="text-[10px] font-bold text-zinc-400">#{contract.id.substring(0, 8)}</span>
            </div>
            <CardTitle className="text-2xl font-black tracking-tighter">
              {formatCurrency(Number(contract.amount))}
            </CardTitle>
          </div>
          <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shadow-sm", statusConfig.class)}>
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pb-6">
        {/* Progress Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <div className="flex items-center text-xs font-bold text-muted-foreground uppercase tracking-tight">
              <Calendar className="h-3 w-3 mr-1.5 opacity-60" />
              Maturité
            </div>
            <div className="text-xs font-black">
              <span className="text-emerald-600 dark:text-emerald-400">{contract.months_paid}</span>
              <span className="text-muted-foreground/40 mx-1">/</span>
              <span>{contract.duration_months} mois</span>
            </div>
          </div>
          <div className="relative h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(16,185,129,0.3)]",
                contract.status === 'active' ? "bg-emerald-500" : "bg-zinc-400"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 group-hover:bg-emerald-50/50 dark:group-hover:bg-emerald-900/10 transition-colors duration-500">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Gains versés</p>
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">+{formatCurrency(totalProfitPaid)}</p>
          </div>
          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/10 transition-colors duration-500">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Taux mensuel</p>
            <p className="text-sm font-black text-blue-600 dark:text-blue-400">{(Number(contract.monthly_rate) * 100).toFixed(0)}% / mois</p>
          </div>
        </div>

        {/* Info badges */}
        <div className="flex flex-wrap gap-2">
          {contract.is_insured && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 text-[10px] font-bold uppercase tracking-tight">
              <Shield className="h-3 w-3" />
              Capital Garanti
            </div>
          )}
          {isEndingSoon && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-800 text-[10px] font-bold uppercase tracking-tight animate-pulse">
              <Zap className="h-3 w-3" />
              Bientôt à terme
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="px-6 py-4 bg-zinc-50/50 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
        <div className="flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          Expire le {format(new Date(contract.end_date), "dd MMM yyyy", { locale: fr })}
        </div>

        {contract.is_insured && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 group/btn"
              >
                Détails Assurance
                <ArrowRight className="ml-1 h-3 w-3 group-hover/btn:translate-x-0.5 transition-transform" />
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl border-none shadow-2xl overflow-hidden p-0 max-w-md">
              <div className="bg-indigo-600 p-8 text-white relative">
                <Shield className="absolute top-4 right-4 h-24 w-24 opacity-10" />
                <DialogHeader className="relative z-10">
                  <DialogTitle className="text-2xl font-black tracking-tight text-white mb-2">Protection du Capital</DialogTitle>
                  <DialogDescription className="text-indigo-100 leading-relaxed">
                    Votre investissement est protégé par notre fond de garantie. L'assurance couvre votre capital initial jusqu'à la fin de la période de garantie configurée.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Couverture depuis le</p>
                    <p className="text-sm font-black">{format(new Date(contract.start_date), "dd MMMM yyyy", { locale: fr })}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Fin estimée de protection</p>
                    <p className="text-sm font-black text-indigo-600">{format(new Date(new Date(contract.start_date).setMonth(new Date(contract.start_date).getMonth() + insuranceDurationMonths)), "dd MMMM yyyy", { locale: fr })}</p>
                  </div>
                </div>

                <div className={cn(
                  "p-4 rounded-2xl flex items-center gap-4 transition-all duration-500 border",
                  contract.months_paid < insuranceDurationMonths 
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800' 
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
                )}>
                  <div className={cn(
                    "p-2 rounded-xl shrink-0",
                    contract.months_paid < insuranceDurationMonths ? 'bg-emerald-500 text-white' : 'bg-zinc-400 text-white'
                  )}>
                    <Shield className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-black uppercase tracking-tight">Statut de Protection</p>
                    <p className={cn(
                      "text-xs font-medium",
                      contract.months_paid < insuranceDurationMonths ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                    )}>
                      {contract.months_paid < insuranceDurationMonths ? 'Protection active et valide' : 'Protection terminée'}
                    </p>
                  </div>
                </div>

                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full rounded-xl font-bold h-12">Compris</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardFooter>
    </Card>
  );
};