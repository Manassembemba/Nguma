
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, FileText, DollarSign } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

// Define the types for the props based on our database schema
type WalletData = Database['public']['Tables']['wallets']['Row'];
type ContractData = Database['public']['Tables']['contracts']['Row'];

interface WalletCardProps {
  wallet: WalletData | undefined;
  contracts: ContractData[] | undefined;
}

/**
 * WalletCard Component
 * 
 * Displays a set of 4 statistic cards summarizing the user's financial status:
 * - Total Balance
 * - Invested Amount
 * - Available Profits
 * - Active Contracts
 */
export const WalletCard = ({ wallet, contracts }: WalletCardProps) => {
  // Helper function to format numbers into currency strings
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: wallet?.currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(amount);
  };

  const activeContracts = contracts?.filter(c => c.status === "active").length || 0;
  const totalProfit = Number(wallet?.profit_balance || 0);
  const totalInvested = contracts
    ?.filter(c => c.status === "active")
    .reduce((sum, contract) => sum + Number(contract.amount), 0) || 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="bg-gradient-card border-border/50 shadow-elegant">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Montant Déposé</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(Number(wallet?.total_balance || 0))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total des dépôts effectués
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border/50 shadow-elegant">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Investis</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(totalInvested)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Montant total investi
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border/50 shadow-elegant">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Profits</CardTitle>
          <TrendingUp className="h-4 w-4 text-profit" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-profit">
            +{formatCurrency(totalProfit)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Profits disponibles
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border/50 shadow-elegant">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Contrats Actifs</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeContracts}</div>
          <p className="text-xs text-muted-foreground mt-1">
            En cours
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
