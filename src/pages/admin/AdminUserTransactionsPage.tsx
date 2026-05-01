import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format } from 'date-fns';

// Assume a function getTransactionsForUser exists or will be created in transactionService.ts
// For now, we'll mock it in the component.
// import { getTransactionsForUser } from '@/services/transactionService'; 

// Mock function to simulate fetching transactions by userId
async function fetchTransactionsForUser(userId: string) {
  // In a real scenario, this would call an API like:
  // const response = await fetch(`/api/admin/users/${userId}/transactions`);
  // const data = await response.json();
  // return data;

  console.log(`Simulating fetch for transactions of user: \${userId}`);
  // Mock data - replace with actual API call
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        transactions: [
          { id: 'tx-1', type: 'deposit', amount: 500.00, status: 'completed', description: 'Dépôt via mpesa', created_at: '2026-04-20T10:00:00Z' },
          { id: 'tx-2', type: 'investment', amount: 495.00, status: 'completed', description: 'Nouveau contrat', created_at: '2026-04-20T10:05:00Z' },
          { id: 'tx-3', type: 'profit', amount: 99.00, status: 'completed', description: 'Profit mois 1', created_at: '2026-05-20T10:05:00Z' },
          { id: 'tx-4', type: 'withdrawal', amount: 100.00, status: 'pending', description: 'Retrait via ecobank', created_at: '2026-05-21T11:00:00Z' },
        ],
        count: 4,
      });
    }, 500);
  });
}


const AdminUserTransactionsPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTransactions = async () => {
      if (!userId) {
        setError("ID utilisateur non trouvé.");
        setLoading(false);
        return;
      }
      try {
        // In a real app, use useQuery from @tanstack/react-query
        // For this example, we simulate the fetch here.
        const result: any = await fetchTransactionsForUser(userId);
        setTransactions(result.transactions);
      } catch (err: any) {
        setError(err.message || "Erreur lors du chargement des transactions.");
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [userId]);

  if (loading) {
    return <div>Chargement des transactions...</div>;
  }

  if (error) {
    return <div className="text-red-500">Erreur : {error}</div>;
  }

  return (
    <div className="p-8 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Transactions pour l'Utilisateur</CardTitle>
          <CardHeader>
            <Button asChild variant="outline">
              <Link to="/admin/users">Retour à la liste des utilisateurs</Link>
            </Button>
          </CardHeader>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold mb-4">ID Utilisateur : {userId}</p>
          <Separator className="my-4" />

          {transactions.length === 0 ? (
            <p>Aucune transaction trouvée pour cet utilisateur.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                    <TableCell>{tx.type}</TableCell>
                    <TableCell>{tx.amount.toFixed(2)} $US</TableCell>
                    <TableCell>{tx.status}</TableCell>
                    <TableCell>{tx.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUserTransactionsPage;
