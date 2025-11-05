
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Database } from "@/integrations/supabase/types";

type TransactionData = Database['public']['Tables']['transactions']['Row'];

interface TransactionTableProps {
  recentTransactions: TransactionData[] | undefined;
  formatCurrency: (amount: number) => string;
}

/**
 * TransactionTable Component
 * 
 * Displays a list of recent transactions for the user.
 * It includes transaction type, date, and formatted amount.
 */
export const TransactionTable = ({ recentTransactions, formatCurrency }: TransactionTableProps) => {
  return (
    <Card className="shadow-elegant border-border/50">
      <CardHeader>
        <CardTitle>Dernières Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentTransactions && recentTransactions.length > 0 ? (
            recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
              >
                <div>
                  <p className="font-medium capitalize">{transaction.type}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(transaction.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div
                  className={`text-lg font-semibold ${
                    transaction.type === "profit" || transaction.type === "deposit"
                      ? "text-profit"
                      : transaction.type === "withdrawal"
                      ? "text-loss"
                      : ""
                  }`}
                >
                  {transaction.type === "withdrawal" ? "-" : "+"}
                  {formatCurrency(Number(transaction.amount))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Aucune transaction pour le moment
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
