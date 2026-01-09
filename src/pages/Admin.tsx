
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminDashboardStats } from "@/services/adminService";
import { formatCurrency } from "@/lib/utils";
import { AdminProfitChart } from "@/components/admin/AdminProfitChart";
import { CashFlowChart } from "@/components/admin/CashFlowChart";
import { UserGrowthChart } from "@/components/admin/UserGrowthChart";
import { InvestorListTable } from "@/components/admin/InvestorListTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, DollarSign, TrendingUp, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const StatCard = ({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon?: React.ElementType;
}) => {
  return (
    <div className="flex flex-col gap-1 rounded-lg p-6 border bg-card shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm font-medium">{title}</p>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
};

const AdminPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["adminStats"],
    queryFn: getAdminDashboardStats,
  });

  useEffect(() => {
    const channel = supabase.channel('admin-dashboard-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload) => {
          // When a change occurs in transactions (like approve/reject), invalidate stats to refetch
          queryClient.invalidateQueries({ queryKey: ['adminStats'] });
          queryClient.invalidateQueries({ queryKey: ['cashFlowSummary'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'auth', table: 'users' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['userGrowthSummary'] });
        }
      )
      .subscribe();

    // Cleanup subscription on component unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);


  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">Tableau de Bord Administrateur</h1>
        <p className="text-muted-foreground">Vue d'ensemble de la plateforme</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Investisseurs"
            value={stats?.total_investors?.toLocaleString() || '0'}
            icon={Users}
          />
          <StatCard
            title="Fonds Sous Gestion"
            value={formatCurrency(stats?.funds_under_management || 0)}
            icon={DollarSign}
          />
          <StatCard
            title="Profit Total"
            value={formatCurrency(stats?.total_profit || 0)}
            icon={TrendingUp}
          />
          <div className="cursor-pointer" onClick={() => navigate('/admin/deposits')}>
            <StatCard
              title="Dépôts en Attente"
              value={formatCurrency(stats?.pending_deposits || 0)}
              icon={ArrowDownCircle}
            />
          </div>
          <div className="cursor-pointer" onClick={() => navigate('/admin/withdrawals')}>
            <StatCard
              title="Retraits en Attente"
              value={formatCurrency(stats?.pending_withdrawals || 0)}
              icon={ArrowUpCircle}
            />
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-6">
        <div className="lg:col-span-1">
          <AdminProfitChart />
        </div>
        <div className="lg:col-span-1">
          <CashFlowChart />
        </div>
        <div className="lg:col-span-1">
          <UserGrowthChart />
        </div>
      </div>

      {/* Investor Table */}
      <div className="py-6">
        <InvestorListTable />
      </div>
    </div>
  );
};

export default AdminPage;
