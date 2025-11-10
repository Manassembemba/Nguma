import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllUsers } from "@/services/adminService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { UserDetailDialog } from "./UserDetailDialog";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import { ManageContractsDialog } from "./ManageContractsDialog";

export const UserList = () => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isUserDetailDialogOpen, setIsUserDetailDialogOpen] = useState(false);
  const [isManageContractsDialogOpen, setIsManageContractsDialogOpen] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ["allUsers"],
    queryFn: getAllUsers,
  });

  const handleViewDetails = (userId: string) => {
    setSelectedUserId(userId);
    setIsUserDetailDialogOpen(true);
  };

  const handleManageContracts = (userId: string) => {
    setSelectedUserId(userId);
    setIsManageContractsDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Liste des Utilisateurs</CardTitle>
          <CardDescription>Affichez et gérez tous les utilisateurs de la plateforme.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Inscrit le</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center">Chargement...</TableCell></TableRow>
                ) : users && users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.full_name || "N/A"}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{format(new Date(user.created_at), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-center flex justify-center items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleViewDetails(user.id)}>
                          Voir les détails
                        </Button>
                        <Dialog open={isManageContractsDialogOpen && selectedUserId === user.id} onOpenChange={setIsManageContractsDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => handleManageContracts(user.id)}>
                              <FileText className="mr-2 h-4 w-4" /> Gérer les contrats
                            </Button>
                          </DialogTrigger>
                          <ManageContractsDialog 
                            userId={user.id} 
                            open={isManageContractsDialogOpen && selectedUserId === user.id} 
                            onOpenChange={setIsManageContractsDialogOpen} 
                          />
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">Aucun utilisateur trouvé.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <UserDetailDialog 
        userId={selectedUserId} 
        open={isUserDetailDialogOpen} 
        onOpenChange={setIsUserDetailDialogOpen} 
      />
    </>
  );
};