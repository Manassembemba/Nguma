
import { useQuery } from "@tanstack/react-query";
import { getContracts } from "@/services/contractService";
import { getWallet } from "@/services/walletService";
import { ContractCard } from "@/components/ContractCard";
import { NewContractDialog } from "@/components/NewContractDialog";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const ContractsPage = () => {
  const { data: contracts, isLoading } = useQuery({
    queryKey: ["contracts"],
    queryFn: getContracts,
  });

  // Fetch wallet data for currency formatting. Uses cache if already available.
  const { data: wallet } = useQuery({ queryKey: ["wallet"], queryFn: getWallet });

  const localFormatCurrency = (amount: number) => {
    return formatCurrency(amount, wallet?.currency || 'USD');
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Mes Contrats</h1>
          <p className="text-muted-foreground">
            Gérez et suivez tous vos contrats d'investissement.
          </p>
        </div>
        <NewContractDialog />
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-[350px]" />)}
        </div>
      ) : contracts && contracts.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {contracts.map((contract) => (
            <ContractCard key={contract.id} contract={contract} formatCurrency={localFormatCurrency} />
          ))}
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-12 bg-muted/30 rounded-lg">
          <p>Vous n'avez aucun contrat pour le moment.</p>
        </div>
      )}
    </div>
  );
};

export default ContractsPage;
