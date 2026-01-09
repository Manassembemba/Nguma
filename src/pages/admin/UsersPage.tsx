
import { InvestorListTable } from "@/components/admin/InvestorListTable";
import { useQuery } from "@tanstack/react-query";
import { getAdminDashboardStats, getUserGrowthSummary } from "@/services/adminService";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserPlus, UserCheck } from "lucide-react";

const UsersPage = () => {
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["adminStats"],
    queryFn: getAdminDashboardStats,
  });

  const { data: growth, isLoading: isLoadingGrowth } = useQuery({
    queryKey: ["userGrowth"],
    queryFn: getUserGrowthSummary,
  });

  // Calculate stats
  const totalInvestors = stats?.total_investors || 0;
  const activeInvestors = stats?.active_investors || 0; // Assuming this field exists or we use a proxy

  // Calculate new users this month
  const currentMonth = new Date().toLocaleString('default', { month: 'short', year: 'numeric' });
  const newUsersThisMonth = growth?.find(g => g.month_year === currentMonth)?.new_users_count || 0;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Gestion des Investisseurs</h1>
        <p className="text-muted-foreground">
          Affichez et gérez les comptes des investisseurs de la plateforme.
        </p>
      </div>

      {/* Stats Cards */}
      {(isLoadingStats || isLoadingGrowth) ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Total Investisseurs</div>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">
                {totalInvestors}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Inscrits sur la plateforme
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Nouveaux (Ce mois)</div>
                <UserPlus className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold text-green-600">
                +{newUsersThisMonth}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Croissance mensuelle
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Investisseurs Actifs</div>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">
                {activeInvestors}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Avec contrats en cours
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Taux de Conversion</div>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">
                {totalInvestors > 0 ? ((activeInvestors / totalInvestors) * 100).toFixed(1) : 0}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Utilisateurs ayant investi
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <InvestorListTable />
    </div>
  );
};

export default UsersPage;
