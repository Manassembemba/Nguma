
import { useQuery } from "@tanstack/react-query";
import { getAdminDashboardStats } from "@/services/adminService";
import { formatCurrency } from "@/lib/utils";
import { AdminProfitChart } from "@/components/admin/AdminProfitChart";
import { InvestorListTable } from "@/components/admin/InvestorListTable";

const StatCard = ({ title, value, glowing = false, glowingColor = 'green' }: { title: string, value: string, glowing?: boolean, glowingColor?: 'green' | 'red' }) => {
  const glowClass = glowing ? (glowingColor === 'green' ? 'glowing-border-green' : 'glowing-border-red') : '';
  const valueColor = glowing ? (glowingColor === 'green' ? 'text-primary' : 'text-destructive') : 'text-text-primary';

  return (
    <div className={`flex min-w-[158px] flex-1 flex-col gap-2 rounded-lg p-6 bg-background-card border border-white/10 hover:border-primary/50 transition-all duration-300 ${glowClass}`}>
      <p className="text-text-secondary text-base font-medium leading-normal">{title}</p>
      <p className={`tracking-light text-2xl font-bold leading-tight ${valueColor}`}>{value}</p>
    </div>
  );
};

const AdminPage = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["adminStats"],
    queryFn: getAdminDashboardStats,
  });

  return (
    <div className="p-8 neon-grid-bg">
      {/* PageHeading */}
      <div className="flex flex-wrap justify-between items-center gap-3 pb-4">
        <p className="text-text-primary text-4xl font-black leading-tight tracking-[-0.033em] min-w-72">Administrator Dashboard</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 py-4">
        <StatCard title="Total Investors" value={isLoading ? '...' : stats?.total_investors?.toLocaleString() || '0'} />
        <StatCard title="Funds Under Management" value={isLoading ? '...' : formatCurrency(stats?.funds_under_management || 0)} />
        <StatCard title="Total Profit" value={isLoading ? '...' : formatCurrency(stats?.total_profit || 0)} glowing={true} glowingColor="green" />
        <StatCard title="Pending Deposits" value={isLoading ? '...' : formatCurrency(stats?.pending_deposits || 0)} glowing={true} glowingColor="red" />
        <StatCard title="Pending Withdrawals" value={isLoading ? '...' : formatCurrency(stats?.pending_withdrawals || 0)} glowing={true} glowingColor="red" />
      </div>

      {/* Charts and Investor Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-6">
        <AdminProfitChart />
        <InvestorListTable />
      </div>
    </div>
  );
};

export default AdminPage;
