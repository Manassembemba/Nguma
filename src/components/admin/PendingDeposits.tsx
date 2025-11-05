
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPendingDeposits, approveDeposit } from "@/services/adminService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

export const PendingDeposits = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: deposits, isLoading } = useQuery({
    queryKey: ["pendingDeposits"],
    queryFn: getPendingDeposits,
  });

  const mutation = useMutation({
    mutationFn: approveDeposit,
    onSuccess: () => {
      toast({ title: "Succès", description: "Dépôt approuvé." });
      queryClient.invalidateQueries({ queryKey: ['pendingDeposits'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      // Also invalidate user-facing queries that might be affected
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  const handleApprove = (transactionId: string) => {
    mutation.mutate(transactionId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dépôts en Attente</CardTitle>
        <CardDescription>Approuvez les dépôts pour créditer les comptes des utilisateurs.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Méthode</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center">Chargement...</TableCell></TableRow>
              ) : deposits && deposits.length > 0 ? (
                deposits.map((deposit) => (
                  <TableRow key={deposit.id}>
                    <TableCell>{format(new Date(deposit.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>{deposit.profile?.email || deposit.user_id}</TableCell>
                    <TableCell className="capitalize">{deposit.method?.replace(/_/g, ' ')}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(deposit.amount), deposit.currency)}</TableCell>
                    <TableCell className="text-center">
                      <Button 
                        size="sm"
                        onClick={() => handleApprove(deposit.id)}
                        disabled={mutation.isPending && mutation.variables === deposit.id}
                      >
                        Approuver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">Aucun dépôt en attente.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
