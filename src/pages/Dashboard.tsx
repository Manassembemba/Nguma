import { useQuery } from "@tanstack/react-query";
import { getWallet } from "@/services/walletService";
import { getContracts } from "@/services/contractService";
import { getRecentTransactions } from "@/services/transactionService";
import { getProfits } from "@/services/profitService";
import { WalletCard } from "@/components/WalletCard";
import { TransactionTable } from "@/components/TransactionTable";
import { ContractCard } from "@/components/ContractCard";
import { ProfitChart } from "@/components/ProfitChart";
import { NewContractDialog } from "@/components/NewContractDialog";
import { DepositDialog } from "@/components/DepositDialog";
import { WithdrawDialog } from "@/components/WithdrawDialog";
import { formatCurrency } from "@/lib/utils";

const Dashboard = () => {
  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: getWallet,
  });

  const { data: contracts } = useQuery({
    queryKey: ["contracts"],
    queryFn: getContracts,
  });

  const { data: recentTransactions } = useQuery({
    queryKey: ["recentTransactions"],
    queryFn: getRecentTransactions,
  });

  const { data: profits } = useQuery({
    queryKey: ["profits"],
    queryFn: getProfits,
  });

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Vue d'ensemble de vos investissements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DepositDialog />
          <WithdrawDialog wallet={wallet} />
        </div>
      </div>

      <WalletCard wallet={wallet} contracts={contracts} />

      {/* Contracts Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Mes Contrats</h2>
          <NewContractDialog />
        </div>
        {contracts && contracts.filter(c => c.status === 'active').length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {contracts.filter(c => c.status === 'active').map((contract) => (
              <ContractCard key={contract.id} contract={contract} formatCurrency={formatCurrency} />
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-12 bg-muted/30 rounded-lg">
            <p>Vous n'avez aucun contrat actif pour le moment.</p>
          </div>
        )}
      </div>

      {/* Profit Chart Section */}
      <div>
        <ProfitChart profits={profits} />
      </div>

      <TransactionTable recentTransactions={recentTransactions} formatCurrency={formatCurrency} />
    </div>
  );
};

export default Dashboard;