
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  XCircle, 
  ExternalLink, 
  Search, 
  Loader2, 
  User as UserIcon,
  Shield,
  FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const KycManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [documentViewer, setDocumentViewer] = useState<{ isOpen: boolean; url: string; label: string }>({ isOpen: false, url: "", label: "" });

  // Fetch pending KYC requests
  const { data: pendingKycs, isLoading } = useQuery({
    queryKey: ["pendingKycs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("kyc_status", "pending")
        .order("kyc_submitted_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const reviewKycMutation = useMutation({
    mutationFn: async ({ userId, status, reason }: { userId: string, status: string, reason?: string }) => {
      const { data, error } = await supabase.rpc('admin_review_kyc', {
        p_user_id: userId,
        p_status: status,
        p_reason: reason
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Succès", description: "La vérification KYC a été traitée." });
        queryClient.invalidateQueries({ queryKey: ["pendingKycs"] });
        setIsRejectDialogOpen(false);
        setRejectionReason("");
        setSelectedUser(null);
      } else {
        toast({ variant: "destructive", title: "Erreur", description: data.error });
      }
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  const handleApprove = (userId: string) => {
    reviewKycMutation.mutate({ userId, status: 'verified' });
  };

  const openRejectDialog = (user: any) => {
    setSelectedUser(user);
    setIsRejectDialogOpen(true);
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      toast({ variant: "destructive", title: "Erreur", description: "Veuillez fournir une raison pour le refus." });
      return;
    }
    reviewKycMutation.mutate({ 
      userId: selectedUser.id, 
      status: 'rejected', 
      reason: rejectionReason 
    });
  };

  const getDocTypeLabel = (type: string) => {
    switch (type) {
      case 'ID_CARD': return "Carte d'Identité";
      case 'PASSPORT': return "Passeport";
      case 'DRIVING_LICENSE': return "Permis de Conduire";
      default: return type || "Document";
    }
  };

  const getDocumentUrl = async (path: string) => {
    if (!path) return "";
    const { data, error } = await supabase.storage.from('kyc-documents').createSignedUrl(path, 60);
    if (error) {
      console.error("Error generating signed URL:", error);
      return "";
    }
    return data.signedUrl;
  };

  const DocumentLink = ({ path, label }: { path: string, label: string }) => {
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
      setLoading(true);
      const signedUrl = await getDocumentUrl(path);
      setLoading(false);
      if (signedUrl) setDocumentViewer({ isOpen: true, url: signedUrl, label });
    };

    return (
      <Button 
        variant="ghost" 
        size="sm"
        onClick={handleClick}
        className="rounded-xl hover:bg-primary/5 hover:text-primary transition-all text-[10px] h-7"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
        {label}
      </Button>
    );
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Gestion des Vérifications KYC
          </h1>
          <p className="text-muted-foreground font-bold">Examinez et validez les documents d'identité des investisseurs.</p>
        </div>
        <Badge variant="outline" className="h-8 px-4 rounded-full border-primary/20 text-primary font-bold">
          {pendingKycs?.length || 0} Demande(s) en attente
        </Badge>
      </div>

      <Card className="border-none shadow-premium rounded-[2rem] overflow-hidden">
        <CardHeader className="border-b bg-zinc-50/50 dark:bg-zinc-900/50">
          <CardTitle className="text-lg font-black">Demandes en attente</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : pendingKycs && pendingKycs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-zinc-100 dark:border-zinc-800">
                  <TableHead className="font-bold py-4">Utilisateur</TableHead>
                  <TableHead className="font-bold py-4">Document</TableHead>
                  <TableHead className="font-bold py-4">Soumis le</TableHead>
                  <TableHead className="font-bold py-4 text-center">Pièce Jointe</TableHead>
                  <TableHead className="font-bold py-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingKycs.map((kyc) => (
                  <TableRow key={kyc.id} className="border-zinc-100 dark:border-zinc-800 transition-colors">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                          <UserIcon className="h-5 w-5 text-zinc-500" />
                        </div>
                        <div>
                          <p className="font-black text-sm">{kyc.first_name} {kyc.last_name}</p>
                          <p className="text-xs text-muted-foreground">{kyc.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 font-bold text-sm">
                      <Badge variant="secondary" className="rounded-lg font-bold">
                        {getDocTypeLabel(kyc.kyc_document_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 text-xs font-bold text-muted-foreground">
                      {kyc.kyc_submitted_at ? format(new Date(kyc.kyc_submitted_at), 'PPP', { locale: fr }) : 'N/A'}
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <div className="flex flex-col gap-1">
                        <DocumentLink path={kyc.kyc_id_front_url} label="ID Recto" />
                        <DocumentLink path={kyc.kyc_id_back_url} label="ID Verso" />
                        <DocumentLink path={kyc.kyc_residence_proof_url} label="Domicile" />
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openRejectDialog(kyc)}
                          className="rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Refuser
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => handleApprove(kyc.id)}
                          disabled={reviewKycMutation.isPending}
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                        >
                          {reviewKycMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                          Approuver
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-20 text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-zinc-50 dark:bg-zinc-900 rounded-full flex items-center justify-center">
                <Shield className="h-8 w-8 text-zinc-300" />
              </div>
              <p className="text-zinc-500 font-bold">Aucune demande KYC en attente.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={documentViewer.isOpen} onOpenChange={(open) => !open && setDocumentViewer({ isOpen: false, url: "", label: "" })}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-3xl border-none">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-black text-lg">{documentViewer.label}</h3>
            <Button variant="ghost" size="sm" onClick={() => setDocumentViewer({ isOpen: false, url: "", label: "" })}>Fermer</Button>
          </div>
          <div className="bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center p-4">
            <img 
              src={documentViewer.url} 
              alt={documentViewer.label} 
              className="max-h-[70vh] object-contain rounded-xl"
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="rounded-[2rem] border-none shadow-2xl dark:bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Refuser la vérification</DialogTitle>
            <DialogDescription className="font-bold">
              Expliquez à l'investisseur pourquoi son document n'a pas été accepté.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <UserIcon className="h-5 w-5 text-zinc-500" />
              <p className="font-bold text-sm">{selectedUser?.first_name} {selectedUser?.last_name}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-widest text-zinc-600">Raison du refus</label>
              <Textarea 
                placeholder="Ex: La photo est floue, le document est expiré..."
                className="rounded-2xl min-h-[120px] font-bold border-zinc-200 dark:border-zinc-800"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsRejectDialogOpen(false)} className="rounded-xl font-bold">Annuler</Button>
            <Button 
              onClick={handleReject} 
              disabled={reviewKycMutation.isPending}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold px-8 shadow-lg"
            >
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KycManagement;
