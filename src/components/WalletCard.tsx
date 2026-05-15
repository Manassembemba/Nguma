
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, TrendingUp, FileText, DollarSign, ArrowUpRight } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type WalletData = Database['public']['Tables']['wallets']['Row'];
type ContractData = Database['public']['Tables']['contracts']['Row'];

interface WalletCardProps {
  wallet: WalletData | undefined;
  contracts: ContractData[] | undefined;
}

export const WalletCard = ({ wallet, contracts }: WalletCardProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: wallet?.currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const activeContracts = contracts?.filter(c => c.status === "active").length || 0;
  const totalProfit = Number(wallet?.profit_balance || 0);
  const totalInvested = contracts
    ?.filter(c => c.status === "active")
    .reduce((sum, contract) => sum + Number(contract.amount), 0) || 0;
  const totalBalance = Number(wallet?.total_balance || 0);

  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Balance - Premium Card */}
      <Card className="relative overflow-hidden border-none bg-gradient-to-br from-zinc-900 to-zinc-800 text-white shadow-premium group transition-all duration-300 hover:shadow-2xl sm:col-span-1 lg:col-span-1">
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <Wallet className="h-24 w-24 -mr-8 -mt-8 rotate-12" />
        </div>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded text-white/80">Principal</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-tight">Solde Total</p>
            <div className="text-2xl sm:text-3xl font-bold tracking-tighter">
              {formatCurrency(totalBalance)}
            </div>
          </div>
          <div className="mt-4 flex items-center text-[10px] text-zinc-400 font-medium">
            <ArrowUpRight className="h-3 w-3 mr-1 text-emerald-400" />
            <span>Fonds disponibles pour investissement</span>
          </div>
        </CardContent>
      </Card>

      {/* Invested - Elegant Card */}
      <Card className="border-none shadow-elegant transition-all duration-300 hover:shadow-premium group">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg group-hover:scale-110 transition-transform">
              <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-tight">Montant Investi</p>
            <div className="text-2xl font-bold tracking-tight">
              {formatCurrency(totalInvested)}
            </div>
          </div>
          <div className="mt-4 h-1 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-1000" 
              style={{ width: totalBalance > 0 ? `${Math.min((totalInvested / (totalBalance + totalInvested)) * 100, 100)}%` : '0%' }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Profits - Success Card */}
      <Card className="border-none shadow-elegant transition-all duration-300 hover:shadow-premium group">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg group-hover:scale-110 transition-transform">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
              <ArrowUpRight className="h-3 w-3 mr-0.5" />
              ROI
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-tight">Profits Générés</p>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              +{formatCurrency(totalProfit)}
            </div>
          </div>
          <p className="mt-4 text-[10px] text-muted-foreground font-medium">
            Prêts à être retirés ou réinvestis
          </p>
        </CardContent>
      </Card>

      {/* Active Contracts - Neutral Card */}
      <Card className="border-none shadow-elegant transition-all duration-300 hover:shadow-premium group">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg group-hover:scale-110 transition-transform">
              <FileText className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-tight">Contrats Actifs</p>
            <div className="text-2xl font-bold tracking-tight">
              {activeContracts}
            </div>
          </div>
          <div className="mt-4 flex gap-1">
            {[...Array(5)].map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "h-1 flex-1 rounded-full",
                  i < activeContracts ? "bg-zinc-800 dark:bg-zinc-200" : "bg-zinc-100 dark:bg-zinc-800"
                )} 
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
