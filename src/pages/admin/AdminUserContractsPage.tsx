
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getUserContracts, getUserDetails } from "@/services/adminService";
import { ContractCard } from "@/components/ContractCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, DollarSign, TrendingUp, FileText, Plus } from "lucide-react";

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
  const profile = userDetails?.profile;
  const userName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : userDetails?.profile?.email || `Utilisateur ${userId?.substring(0, 8)}`;
  const userEmail = userDetails?.profile?.email;

  // Calculate stats
  const userContracts = contracts || [];
  const walletCurrency = userDetails?.wallet?.currency || 'USD';
  const totalInvested = userContracts.reduce((sum, c) => sum + Number(c.amount), 0);
  const totalProfits = userContracts.reduce((sum, c) => sum + Number(c.total_profit_paid || 0), 0);
  const totalEstimatedProfitAll = userContracts.reduce((sum, c) => {
    const rate = Number(c.monthly_rate || 0);
    return sum + (Number(c.amount) * rate * Number(c.duration_months));
  }, 0);
  const activeContractsCount = userContracts.filter(c => c.status === 'active').length;

  const localFormatCurrency = (amount: number) => {
    return formatCurrency(amount, walletCurrency);
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {isLoading ? (
          <Skeleton className="h-12 w-1/2" />
        ) : (
          <div>
            <h1 className="text-3xl font-bold">Contrats de {userName}</h1>
            <div className="flex items-center gap-2 text-muted-foreground mt-1">
              <span>{userEmail}</span>
              <span>•</span>
              <span className="font-mono text-xs bg-muted协议 px-2 py-1 rounded">
                {userId}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Skeleton className="h-[100px] rounded-lg" />
          <Skeleton className="h-[100px] rounded-lg" />
          <Skeleton className="h-[100px] rounded-lg" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Total Investi</div>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">
                {localFormatCurrency(totalInvested)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Profits Générés</div>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold text-green-600">
                {localFormatCurrency(totalProfits)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Contrats Actifs</div>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">
                {activeContractsCount} <span className="text-sm font-normal text-muted-foreground">/ {userContracts.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : userContracts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userContracts.map((contract) => (
            <ContractCard
              key={contract.id}
              contract={contract}
              formatCurrency={localFormatCurrency}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-muted/30 rounded-lg border-2 border-dashed">
          <div className="text-6xl mb-4">📂</div>
          <h3 className="text-2xl font-semibold mb-2">
            Aucun contrat trouvé
          </h3>
          <p className="text-muted-foreground mb-6">
            Cet utilisateur n'a pas encore d'investissement.
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminUserContractsPage;
