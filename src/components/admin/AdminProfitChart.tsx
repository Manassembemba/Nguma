
import { useQuery } from "@tanstack/react-query";
import { getAggregateProfitsByMonth } from "@/services/adminService";
import { Card, CardContent } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

export const AdminProfitChart = () => {
  const { data: profits, isLoading } = useQuery({
    queryKey: ["aggregateProfits"],
    queryFn: getAggregateProfitsByMonth,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 rounded-lg bg-background-card border border-white/10 p-6 min-h-[300px]">
        <p className="text-text-secondary text-base font-medium leading-normal">Chargement du graphique...</p>
      </div>
    );
  }

  if (!profits || profits.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-lg bg-background-card border border-white/10 p-6 min-h-[300px]">
        <p className="text-text-secondary text-base font-medium leading-normal">Aucune donnée de profit agrégée.</p>
      </div>
    );
  }

  // Recharts expects data in a specific format, and the RPC returns cumulative data
  // The RPC returns total_profit for each month, so we just need to format it.
  const chartData = profits.map(p => ({
    month_year: p.month_year,
    "Total Profit": Number(p.total_profit),
  }));

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-background-card border border-white/10 p-6 h-full">
      <p className="text-text-secondary text-base font-medium leading-normal">Évolution des Profits</p>
      <p className="text-primary tracking-light text-[32px] font-bold leading-tight truncate">{formatCurrency(chartData[chartData.length - 1]["Total Profit"])}</p>
      <div className="flex gap-1">
        <p className="text-text-secondary text-base font-normal leading-normal">6 derniers mois</p>
        {/* PNL % calculation for last 6 months would go here if needed */}
      </div>
      <div className="flex min-h-[180px] flex-1 flex-col gap-8 py-4">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00FF41" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#00FF41" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="month_year" stroke="#888888" tickLine={false} axisLine={false} />
            <YAxis stroke="#888888" tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value, "USD")} />
            <CartesianGrid strokeDasharray="3 3" stroke="#242629" />
            <Tooltip formatter={(value: number) => formatCurrency(value, "USD")} contentStyle={{ backgroundColor: '#1A1A1D', border: 'none' }} itemStyle={{ color: '#EAEAEA' }} />
            <Area type="monotone" dataKey="Total Profit" stroke="#00FF41" fillOpacity={1} fill="url(#colorProfit)" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex justify-around">
          {chartData.map((dataPoint, index) => (
            <p key={index} className="text-text-secondary text-[13px] font-bold leading-normal tracking-[0.015em]">{dataPoint.month_year.substring(0,3)}</p>
          ))}
        </div>
      </div>
    </div>
  );
};
