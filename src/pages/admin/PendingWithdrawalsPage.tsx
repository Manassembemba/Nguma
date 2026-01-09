
import { PendingWithdrawals } from "@/components/admin/PendingWithdrawals";
import { useQuery } from "@tanstack/react-query";
import { getPendingWithdrawals } from "@/services/adminService";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Hash, DollarSign, Clock } from "lucide-react";
import { differenceInDays } from "date-fns";

const PendingWithdrawalsPage = () => {
  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ["pendingWithdrawals"],
    queryFn: getPendingWithdrawals,
  });

  // Calculate stats
  const allWithdrawals = withdrawals || [];
  const totalAmount = allWithdrawals.reduce((sum, w) => sum + Number(w.amount), 0);
  const oldestWithdrawal = allWithdrawals.length > 0
    ? Math.max(...allWithdrawals.map(w => differenceInDays(new Date(), new Date(w.created_at))))
    : 0;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Demandes de Retrait en Attente</h1>
        <p className="text-muted-foreground">
          Approuvez ou rejetez les demandes de retrait des investisseurs
        </p>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Nombre Retraits</div>
                <Hash className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">
                {allWithdrawals.length}
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
                <div className="text-sm text-muted-foreground">Plus Ancien</div>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">
                {oldestWithdrawal}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                jour{oldestWithdrawal > 1 ? 's' : ''} d'attente
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <PendingWithdrawals />
    </div>
  );
};

export default PendingWithdrawalsPage;
