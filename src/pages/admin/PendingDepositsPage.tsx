// Remove the debug component from the PendingDepositsPage
import { PendingDeposits } from "@/components/admin/PendingDeposits";
import { useQuery } from "@tanstack/react-query";
import { getPendingDeposits } from "@/services/adminService";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Hash, DollarSign, TrendingUp, Clock } from "lucide-react";
import { differenceInDays } from "date-fns";

interface PendingDeposit {
  id: string;
  created_at: string;
  amount: number;
  currency: string;
  method: string;
  payment_reference?: string;
  payment_phone_number?: string;
  proof_url?: string;
  profile?: {
    full_name?: string;
    email?: string;
  };
}

const PendingDepositsPage = () => {
  const { data: deposits, isLoading } = useQuery({
    queryKey: ["pendingDeposits"],
    queryFn: async () => {
      const data = await getPendingDeposits();
      return data as unknown as PendingDeposit[];
    },
  });

  // Calculate stats
  const allDeposits = deposits || [];
  const totalAmount = allDeposits.reduce((sum, d) => sum + Number(d.amount), 0);
  const avgAmount = allDeposits.length > 0 ? totalAmount / allDeposits.length : 0;
  const oldestDeposit = allDeposits.length > 0
    ? Math.max(...allDeposits.map(d => differenceInDays(new Date(), new Date(d.created_at))))
    : 0;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Demandes de Dépôt en Attente</h1>
        <p className="text-muted-foreground">
          Approuvez ou rejetez les demandes de dépôt des investisseurs
        </p>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
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
                <div className="text-sm text-muted-foreground">Nombre Dépôts</div>
                <Hash className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">
                {allDeposits.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                En attente de validation
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Total à Approuver</div>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">
                {formatCurrency(totalAmount)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Somme totale
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Montant Moyen</div>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">
                {formatCurrency(avgAmount)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Par dépôt
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Plus Ancien</div>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">
                {oldestDeposit}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                jour{oldestDeposit > 1 ? 's' : ''} d'attente
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <PendingDeposits />
    </div>
  );
};

export default PendingDepositsPage;