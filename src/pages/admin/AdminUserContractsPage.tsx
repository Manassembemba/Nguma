import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getUserContracts, getUserDetails } from "@/services/adminService";
import { ContractCard } from "@/components/ContractCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

const AdminUserContractsPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userId = searchParams.get("userId");

  const { data: userDetails, isLoading: isLoadingUser } = useQuery({
    queryKey: ["userDetailsForContractsPage", userId],
    queryFn: () => getUserDetails(userId!),
    enabled: !!userId,
  });

  const { data: contracts, isLoading: isLoadingContracts } = useQuery({
    queryKey: ["userContractsAdmin", userId],
    queryFn: () => getUserContracts(userId!),
    enabled: !!userId,
  });

  if (!userId) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">Aucun utilisateur sélectionné.</p>
        <Button onClick={() => navigate("/admin")} className="mt-4">
          Retour au tableau de bord
        </Button>
      </div>
    );
  }

  const isLoading = isLoadingUser || isLoadingContracts;
  const userName = userDetails?.profile?.full_name || userDetails?.profile?.email || `Utilisateur ${userId?.substring(0, 8)}`;

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {isLoading ? (
          <Skeleton className="h-8 w-1/2" />
        ) : (
          <h1 className="text-3xl font-bold">Contrats de {userName}</h1>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : contracts && contracts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contracts.map((contract) => (
            <ContractCard 
              key={contract.id} 
              contract={contract} 
              formatCurrency={(amount) => formatCurrency(amount, 'USD')}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border border-dashed rounded-lg">
          <p className="text-muted-foreground">Cet utilisateur n'a aucun contrat.</p>
        </div>
      )}
    </div>
  );
};

export default AdminUserContractsPage;
