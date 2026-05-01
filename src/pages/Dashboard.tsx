import { useQuery } from "@tanstack/react-query";
import { getWallet } from "@/services/walletService";
import { getContracts } from "@/services/contractService";
import { getRecentTransactions } from "@/services/transactionService";
import { getProfits } from "@/services/profitService";
import { getSettings } from "@/services/settingsService";
import { WalletCard } from "@/components/WalletCard";
import { TransactionTable } from "@/components/TransactionTable";
import { ContractCard } from "@/components/ContractCard";
import { ProfitChart } from "@/components/ProfitChart";
import { DashboardActions } from "@/components/DashboardActions";
import { UpcomingPayments } from "@/components/UpcomingPayments";
import { NewContractDialog } from "@/components/NewContractDialog";
import { Button } from "@/components/ui/button";

import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { differenceInDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  useUserTransactionsRealtime,
  useUserContractsRealtime,
  useUserProfitsRealtime,
} from "@/hooks/useRealtimeSync";
// Removed: import { isDepositEnabled, getDepositPeriodStatus } from "@/services/depositPeriodService";
// Removed: import { useDepositStatus } from "@/hooks/useDepositStatus";

const Dashboard = () => {
  // Get current user ID for Realtime filtering
  const { data: userResponse } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => supabase.auth.getUser(),
  });
  const user = userResponse?.data?.user;

  // Enable Realtime synchronization for this user
  useUserTransactionsRealtime(user?.id);
  useUserContractsRealtime(user?.id);
  useUserProfitsRealtime(user?.id);

  const { data: wallet, isLoading: isLoadingWallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: getWallet,
  });

  // Removed: const { depositStatus, isLoading: isLoadingDepositStatus, error } = useDepositStatus();

  const { data: contracts, isLoading: isLoadingContracts } = useQuery({
    queryKey: ["contracts"],
    queryFn: getContracts,
  });

  const { data: recentTransactions, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ["recentTransactions"],
    queryFn: getRecentTransactions,
  });

  const { data: profits, isLoading: isLoadingProfits } = useQuery({
    queryKey: ["profits"],
    queryFn: getProfits,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const activeContracts = contracts?.filter(c => c.status === 'active') || [];
  const totalInvested = activeContracts.reduce((sum, c) => sum + Number(c.amount), 0);

  // ROI = (Total Profit / Total Invested) * 100
  // This shows the percentage return on the invested capital
  const roi = Number(wallet?.invested_balance || 0) > 0
    ? ((Number(wallet?.profit_balance || 0) / Number(wallet?.invested_balance || 0)) * 100)
    : 0;

  // Calculate latest profit and next payment
  const latestProfit = profits?.[0]?.amount || 0;
  const nextPayment = activeContracts.length > 0 ? activeContracts[0] : null;
  const nextPaymentDays = nextPayment ? differenceInDays(new Date(nextPayment.end_date), new Date()) : 0;

  // Get monthly profit rate from settings (default to 0.10 = 10%)
  const monthlyRateSetting = settings?.find(s => s.key === 'monthly_profit_rate');
  const monthlyRatePercent = monthlyRateSetting?.value
    ? (parseFloat(monthlyRateSetting.value) * 100).toFixed(0)
    : '10';

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground font-medium">
            Bienvenue sur votre espace personnel Nguma.
          </p>
        </div>
        <DashboardActions wallet={wallet} />
      </div>

      {/* Wallet Cards with Loading State */}
      <div className="w-full overflow-hidden">
        {isLoadingWallet || isLoadingContracts ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-[100px] md:h-[120px] rounded-2xl shadow-sm" />
            ))}
          </div>
        ) : (
          <div className="w-full">
            <WalletCard wallet={wallet} contracts={contracts} />
          </div>
        )}
      </div>

      {/* Main Stats & Performance Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isLoadingProfits ? (
            <Skeleton className="h-[400px] w-full rounded-3xl" />
          ) : (
            <ProfitChart profits={profits} />
          )}
        </div>
        <div className="lg:col-span-1">
          {isLoadingTransactions ? (
            <Skeleton className="h-[400px] w-full rounded-3xl" />
          ) : (
            <UpcomingPayments contracts={activeContracts} />
          )}
        </div>
      </div>

      {/* Contracts Section with Enhanced Empty State */}
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Mes Contrats Actifs</h2>
          {activeContracts.length > 0 && (
            <span className="text-xs md:text-sm font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full">
              {activeContracts.length} contrat{activeContracts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {isLoadingContracts ? (
          <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-[250px] md:h-[280px] rounded-2xl shadow-sm" />
            ))}
          </div>
        ) : activeContracts.length > 0 ? (
          <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {activeContracts.map((contract) => (
              <div key={contract.id} className="transform transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
                <ContractCard contract={contract} formatCurrency={formatCurrency} />
              </div>
            ))}
          </div>
        ) : (
          <div className="relative overflow-hidden p-8 md:p-16 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-premium text-center space-y-8 group">
            {/* Background decoration */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-700" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors duration-700" />

            <div className="relative mx-auto w-24 h-24 md:w-32 md:h-32">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-pulse-slow"></div>
              <div className="relative flex items-center justify-center w-full h-full bg-white dark:bg-zinc-800 rounded-full shadow-elegant border border-zinc-100 dark:border-zinc-700 text-5xl">
                🚀
              </div>
            </div>

            <div className="max-w-md mx-auto space-y-3 relative z-10">
              <h3 className="text-2xl md:text-3xl font-black tracking-tighter text-foreground">
                Prêt à faire fructifier votre capital ?
              </h3>
              <p className="text-sm md:text-base text-muted-foreground font-medium leading-relaxed">
                Rejoignez des centaines d'investisseurs et commencez à générer jusqu'à <span className="text-emerald-600 dark:text-emerald-400 font-bold underline underline-offset-4 decoration-emerald-500/30">{monthlyRatePercent}% de profit mensuel</span> avec nos contrats sécurisés.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 relative z-10">
              <NewContractDialog />
              <Button variant="link" className="text-muted-foreground hover:text-primary transition-colors font-bold uppercase tracking-widest text-[10px]" asChild>
                <a href="/how-it-works">Découvrir le fonctionnement</a>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;