
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { Database } from '@/integrations/supabase/types';
import { TrendingUp } from "lucide-react";

type ProfitData = Database['public']['Tables']['profits']['Row'];

interface ProfitChartProps {
  profits: ProfitData[] | undefined;
}

export const ProfitChart = ({ profits }: ProfitChartProps) => {
  if (!profits || profits.length === 0) {
    return (
      <Card className="shadow-elegant border-none bg-white dark:bg-zinc-900 h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold tracking-tight">Performance Mensuelle</CardTitle>
          <CardDescription>Visualisation de vos profits générés</CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex flex-col items-center justify-center text-muted-foreground space-y-2">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-full">
            <TrendingUp className="h-6 w-6 text-zinc-400" />
          </div>
          <p className="text-sm font-medium">Aucune donnée de profit disponible.</p>
        </CardContent>
      </Card>
    );
  }

  // Process data for monthly profits for active contracts
  const monthlyProfitsMap = new Map<number, number>();
  profits.forEach(profit => {
    const monthNumber = profit.month_number; 
    if (monthNumber >= 1 && monthNumber <= 12) { 
      monthlyProfitsMap.set(monthNumber, (monthlyProfitsMap.get(monthNumber) || 0) + Number(profit.amount));
    }
  });

  const chartData = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    return {
      month: `${month}`,
      profit: monthlyProfitsMap.get(month) || 0,
    };
  });

  const totalMonthlyProfit = Array.from(monthlyProfitsMap.values()).reduce((a, b) => a + b, 0);

  return (
    <Card className="shadow-premium border-none bg-white dark:bg-zinc-900 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-8">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold tracking-tight flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-emerald-500" />
            Courbe de Croissance
          </CardTitle>
          <CardDescription>Progression de vos gains sur 12 mois</CardDescription>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Gains</div>
          <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD" }).format(totalMonthlyProfit)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
              <XAxis 
                dataKey="month" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }}
                dy={10}
                tickFormatter={(val) => `M${val}`}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip
                cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl shadow-2xl backdrop-blur-md">
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Mois {payload[0].payload.month}</p>
                        <p className="text-sm font-bold text-white">
                          {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD" }).format(payload[0].value as number)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="profit"
                stroke="#10b981"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorProfit)"
                animationDuration={2000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
