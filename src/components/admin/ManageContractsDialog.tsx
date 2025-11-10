import { useState } from "react";
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserContracts, uploadContractPdf } from "@/services/adminService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface ManageContractsDialogProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ManageContractsDialog = ({ userId, open, onOpenChange }: ManageContractsDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(Date.now()); // Key to reset file input

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["userContracts", userId],
    queryFn: () => (userId ? getUserContracts(userId) : Promise.resolve([])),
    enabled: open && !!userId,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ contractId, userId, file }: { contractId: string; userId: string; file: File }) =>
      uploadContractPdf(contractId, userId, file),
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Fichier PDF du contrat téléversé avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ["userContracts", userId] });
      setSelectedFile(null);
      setFileInputKey(Date.now()); // Reset file input
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erreur de téléversement",
        description: error.message,
      });
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleUpload = (contractId: string) => {
    if (!selectedFile || !userId) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez sélectionner un fichier PDF.",
      });
      return;
    }
    uploadMutation.mutate({ contractId, userId, file: selectedFile });
  };

  return (
    <DialogContent className="sm:max-w-[800px]">
      <DialogHeader>
        <DialogTitle>Gérer les Contrats de l'Utilisateur</DialogTitle>
        <DialogDescription>
          Téléversez les fichiers PDF des contrats pour l'utilisateur sélectionné.
        </DialogDescription>
      </DialogHeader>
      <div className="py-4">
        {isLoading ? (
          <p>Chargement des contrats...</p>
        ) : contracts && contracts.length > 0 ? (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Contrat</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Fichier PDF</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell>{contract.id.substring(0, 8)}</TableCell>
                    <TableCell>{contract.amount}</TableCell>
                    <TableCell>{contract.status}</TableCell>
                    <TableCell>
                      {contract.contract_pdf_url ? (
                        <a href={contract.contract_pdf_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                          Voir PDF
                        </a>
                      ) : (
                        "Aucun fichier"
                      )}
                    </TableCell>
                    <TableCell className="text-right flex items-center justify-end space-x-2">
                      <Input 
                        key={fileInputKey} // Use key to reset input
                        id={`file-upload-${contract.id}`}
                        type="file" 
                        accept="application/pdf" 
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <label htmlFor={`file-upload-${contract.id}`} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-3 cursor-pointer">
                        <Upload className="mr-2 h-4 w-4" /> Choisir un fichier
                      </label>
                      <Button 
                        size="sm" 
                        onClick={() => handleUpload(contract.id)}
                        disabled={!selectedFile || uploadMutation.isPending}
                      >
                        {uploadMutation.isPending ? "Téléversement..." : "Téléverser"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p>Aucun contrat trouvé pour cet utilisateur.</p>
        )}
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>Fermer</Button>
      </DialogFooter>
    </DialogContent>
  );
};
