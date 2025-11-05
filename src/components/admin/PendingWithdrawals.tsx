
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPendingWithdrawals, approveWithdrawal, rejectWithdrawal } from "@/services/adminService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

export const PendingWithdrawals = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ["pendingWithdrawals"],
    queryFn: getPendingWithdrawals,
  });

  const approveMutation = useMutation({
    mutationFn: approveWithdrawal,
    onSuccess: () => {
      toast({ title: "Succès", description: "Retrait approuvé." });
      queryClient.invalidateQueries({ queryKey: ['pendingWithdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ transactionId, reason }: { transactionId: string, reason: string }) => rejectWithdrawal(transactionId, reason),
    onSuccess: () => {
      toast({ title: "Succès", description: "Retrait rejeté." });
      queryClient.invalidateQueries({ queryKey: ['pendingWithdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  const handleApprove = (transactionId: string) => approveMutation.mutate(transactionId);
  const handleReject = (transactionId: string) => {
    const reason = prompt("Raison du rejet ?");
    if (reason) {
      rejectMutation.mutate({ transactionId, reason });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retraits en Attente</CardTitle>
        <CardDescription>Approuvez ou rejetez les demandes de retrait des utilisateurs.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center">Chargement...</TableCell></TableRow>
              ) : withdrawals && withdrawals.length > 0 ? (
                withdrawals.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>{format(new Date(w.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>{w.profile?.email || w.user_id}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(w.amount), w.currency)}</TableCell>
                    <TableCell className="text-center space-x-2">
                      <Button size="sm" variant="outline" onClick={() => handleReject(w.id)} disabled={rejectMutation.isPending || approveMutation.isPending}>Rejeter</Button>
                      <Button size="sm" onClick={() => handleApprove(w.id)} disabled={approveMutation.isPending || rejectMutation.isPending}>Approuver</Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-24">Aucun retrait en attente.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
