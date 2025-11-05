import { useQuery } from "@tanstack/react-query";
import { getWallet } from "@/services/walletService";
import { getContracts } from "@/services/contractService";
import { getRecentTransactions } from "@/services/transactionService";
import { WalletCard } from "@/components/WalletCard";
import { DepositDialog } from "@/components/DepositDialog";
import { WithdrawDialog } from "@/components/WithdrawDialog";
import { ReinvestDialog } from "@/components/ReinvestDialog";
import { TransactionTable } from "@/components/TransactionTable";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

const WalletPage = () => {
  const { data: wallet, isLoading: isLoadingWallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: getWallet,
  });

  const { data: contracts, isLoading: isLoadingContracts } = useQuery({
    queryKey: ["contracts"],
    queryFn: getContracts,
  });

  const { data: recentTransactions, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ["recentTransactions"],
    queryFn: getRecentTransactions,
  });

  const isLoading = isLoadingWallet || isLoadingContracts;

  const localFormatCurrency = (amount: number) => {
    return formatCurrency(amount, wallet?.currency || 'USD');
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Mon Portefeuille</h1>
          <p className="text-muted-foreground">
            Consultez vos soldes et effectuez des dépôts ou retraits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DepositDialog />
          <WithdrawDialog wallet={wallet} />
          <ReinvestDialog wallet={wallet} />
        </div>
      </div>

      <div>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[125px]" />)}
          </div>
        ) : (
          <WalletCard wallet={wallet} contracts={contracts} />
        )}
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Historique Récent</h2>
        {isLoadingTransactions ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <TransactionTable recentTransactions={recentTransactions} formatCurrency={localFormatCurrency} />
        )}
      </div>
    </div>
  );
};

export default WalletPage;