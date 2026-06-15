
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  User as UserIcon,
  Shield,
  FileText,
  Clock,
  Mail,
  Eye,
  Trash2,
  Calendar,
  AlertCircle
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
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
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

  const reviewDocMutation = useMutation({
    mutationFn: async ({ userId, docType, status, reason }: { userId: string, docType: string, status: string, reason?: string }) => {
      const { data, error } = await supabase.rpc('admin_review_kyc_document', {
        p_user_id: userId,
        p_document_type: docType,
        p_status: status,
        p_reason: reason
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Document traité", description: "Le statut du document a été mis à jour." });
        queryClient.invalidateQueries({ queryKey: ["pendingKycs"] });
      } else {
        toast({ variant: "destructive", title: "Erreur", description: data.error });
      }
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  const handleApproveDoc = (userId: string, docType: string) => {
    reviewDocMutation.mutate({ userId, docType, status: 'verified' });
  };

  const openRejectDialog = (user: any, docType: string | null = null) => {
    setSelectedUser(user);
    setSelectedDocType(docType);
    setIsRejectDialogOpen(true);
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      toast({ variant: "destructive", title: "Erreur", description: "Veuillez fournir une raison pour le refus." });
      return;
    }

    if (selectedDocType) {
      reviewDocMutation.mutate({ 
        userId: selectedUser.id, 
        docType: selectedDocType,
        status: 'rejected', 
        reason: rejectionReason 
      }, {
        onSuccess: (data) => {
          if (data.success) {
            setIsRejectDialogOpen(false);
            setRejectionReason("");
            setSelectedDocType(null);
            setSelectedUser(null);
          }
        }
      });
    } else {
      reviewKycMutation.mutate({ 
        userId: selectedUser.id, 
        status: 'rejected', 
        reason: rejectionReason 
      });
    }
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

  const DocumentCard = ({ path, label, status, onApprove, onReject, isPending }: { 
    path: string, 
    label: string, 
    status?: string, 
    onApprove?: () => void,
    onReject?: () => void,
    isPending?: boolean
  }) => {
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
      setLoading(true);
      const signedUrl = await getDocumentUrl(path);
      setLoading(false);
      if (signedUrl) setDocumentViewer({ isOpen: true, url: signedUrl, label });
    };

    const statusConfig = {
      verified: { color: 'text-zinc-900 bg-emerald-100 border-emerald-200', icon: <CheckCircle className="h-4 w-4" />, label: 'Validé' },
      rejected: { color: 'text-zinc-900 bg-rose-100 border-rose-200', icon: <XCircle className="h-4 w-4" />, label: 'Refusé' },
      pending: { color: 'text-zinc-900 bg-amber-100 border-amber-200', icon: <Clock className="h-4 w-4" />, label: 'En attente' },
      not_submitted: { color: 'text-zinc-500 bg-zinc-100 border-zinc-200', icon: <FileText className="h-4 w-4" />, label: 'Non soumis' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { color: 'hidden', icon: null, label: '' };

    return (
      <div className={`group relative flex flex-col p-4 rounded-[1.5rem] border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${config.color} border-2`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-white/70 backdrop-blur-sm">
              <FileText className="h-5 w-5" />
            </div>
            <span className="font-black text-sm uppercase tracking-tight text-zinc-900">{label}</span>
          </div>
          <Badge variant="outline" className="border-current/20 font-bold text-[10px] py-0 px-2 rounded-full bg-white/50">
            {config.label}
          </Badge>
        </div>

        <div className="flex items-center gap-2 mt-auto">
          <Button 
            variant="secondary" 
            size="sm"
            onClick={handleClick}
            className="flex-1 bg-white hover:bg-zinc-50 border-none rounded-xl font-bold text-xs h-9 shadow-sm text-zinc-900"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            Voir
          </Button>

          {status === 'pending' && (
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={onReject}
                disabled={isPending}
                className="h-9 w-9 rounded-xl hover:bg-rose-500 hover:text-white text-rose-700 transition-colors bg-white shadow-sm border border-rose-200"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={onApprove}
                disabled={isPending}
                className="h-9 w-9 rounded-xl hover:bg-emerald-500 hover:text-white text-emerald-700 transition-colors bg-white shadow-sm border border-emerald-200"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 md:p-10 space-y-10 max-w-7xl mx-auto min-h-screen pb-32">
      {/* Header Section */}
      <div className="relative overflow-hidden p-10 rounded-[2.5rem] bg-zinc-950 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full -mr-20 -mt-20 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 blur-[80px] rounded-full -ml-10 -mb-10" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <Badge variant="secondary" className="bg-primary/20 text-primary border-none font-black px-3 py-1 rounded-full text-xs uppercase tracking-widest">
                Admin Security
              </Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white">
              Centre de Vérification <span className="text-primary">KYC</span>
            </h1>
            <p className="text-zinc-300 font-medium max-w-lg">
              Authentifiez les investisseurs en examinant leurs pièces d'identité et justificatifs de domicile.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="px-6 py-4 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm text-right">
              <span className="block text-zinc-400 text-xs font-black uppercase tracking-widest mb-1">En attente</span>
              <span className="text-4xl font-black text-white">{pendingKycs?.length || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="font-bold text-zinc-600 animate-pulse uppercase tracking-widest text-xs">Chargement des dossiers...</p>
          </div>
        ) : pendingKycs && pendingKycs.length > 0 ? (
          <div className="grid grid-cols-1 gap-8">
            {pendingKycs.map((kyc) => (
              <Card key={kyc.id} className="border-none shadow-premium rounded-[2.5rem] overflow-hidden group transition-all duration-500 hover:shadow-hover bg-white dark:bg-zinc-900 border border-zinc-100">
                <div className="flex flex-col lg:flex-row">
                  {/* Left Sidebar: User Info */}
                  <div className="lg:w-1/3 p-8 bg-zinc-50 dark:bg-zinc-800 border-r border-zinc-100 dark:border-zinc-700 flex flex-col justify-between">
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-[1.5rem] bg-white shadow-sm flex items-center justify-center text-zinc-500 border border-zinc-100">
                          <UserIcon className="h-8 w-8" />
                        </div>
                        <div>
                          <h3 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">{kyc.first_name} {kyc.last_name}</h3>
                          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 text-xs font-bold mt-1">
                            <Mail className="h-3 w-3" />
                            {kyc.email}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-700 shadow-sm">
                          <span className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400">Type de doc</span>
                          <Badge variant="secondary" className="font-bold rounded-lg text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white">{getDocTypeLabel(kyc.kyc_document_type)}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-700 shadow-sm">
                          <span className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400">Soumis le</span>
                          <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-bold text-xs">
                            <Calendar className="h-3 w-3 text-zinc-400" />
                            {kyc.kyc_submitted_at ? format(new Date(kyc.kyc_submitted_at), 'dd MMM yyyy', { locale: fr }) : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => openRejectDialog(kyc)}
                        className="w-full rounded-2xl text-rose-700 hover:bg-rose-50 hover:text-rose-800 font-black uppercase tracking-widest text-[10px] py-6 border border-rose-100"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Refuser le dossier complet
                      </Button>
                    </div>
                  </div>

                  {/* Right Content: Documents Review */}
                  <div className="flex-1 p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-sm font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Pièces à examiner</h4>
                      <Badge variant="outline" className="rounded-full font-bold text-amber-700 bg-amber-100 border-amber-200">Action requise</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <DocumentCard 
                        path={kyc.kyc_id_front_url} 
                        label="Pièce d'identité" 
                        status={kyc.kyc_id_front_status}
                        onApprove={() => handleApproveDoc(kyc.id, 'id_front')}
                        onReject={() => openRejectDialog(kyc, 'id_front')}
                        isPending={reviewDocMutation.isPending}
                      />
                      <DocumentCard 
                        path={kyc.kyc_residence_proof_url} 
                        label="Justificatif Domicile" 
                        status={kyc.kyc_residence_proof_status}
                        onApprove={() => handleApproveDoc(kyc.id, 'residence_proof')}
                        onReject={() => openRejectDialog(kyc, 'residence_proof')}
                        isPending={reviewDocMutation.isPending}
                      />
                    </div>

                    <div className="mt-8 p-6 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 flex items-start gap-4">
                      <div className="p-2 bg-white dark:bg-zinc-950 rounded-xl shadow-sm">
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-black text-amber-900 dark:text-amber-200">Note de sécurité</p>
                        <p className="text-xs text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                          Assurez-vous que les informations sur les documents correspondent parfaitement aux données du profil utilisateur. Les documents doivent être lisibles, non coupés et en cours de validité.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="py-32 flex flex-col items-center justify-center text-center space-y-6 bg-zinc-50 dark:bg-zinc-900 rounded-[3rem] border border-zinc-200 dark:border-zinc-800">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150 animate-pulse" />
              <div className="relative mx-auto w-24 h-24 bg-white dark:bg-zinc-950 shadow-xl rounded-[2rem] flex items-center justify-center">
                <Shield className="h-12 w-12 text-zinc-300 dark:text-zinc-700" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white">Tout est en ordre</h3>
              <p className="text-zinc-600 dark:text-zinc-400 font-bold max-w-xs mx-auto">
                Aucune nouvelle demande de vérification n'est en attente pour le moment.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Document Viewer Modal */}
      <Dialog open={documentViewer.isOpen} onOpenChange={(open) => !open && setDocumentViewer({ isOpen: false, url: "", label: "", isPdf: false })}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl bg-zinc-950/90 backdrop-blur-xl">
          <div className="p-6 border-b border-white/10 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-xl">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-black text-xl tracking-tight text-white">{documentViewer.label}</h3>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setDocumentViewer({ isOpen: false, url: "", label: "", isPdf: false })} className="rounded-full hover:bg-white/10 text-white">
              <XCircle className="h-6 w-6" />
            </Button>
          </div>
          <div className="bg-zinc-900/50 flex items-center justify-center p-8 min-h-[70vh]">
            {documentViewer.isPdf ? (
              <iframe 
                src={documentViewer.url} 
                className="w-full h-[70vh] rounded-2xl"
                title={documentViewer.label}
              />
            ) : (
              <img 
                src={documentViewer.url} 
                alt={documentViewer.label} 
                className="max-h-[70vh] object-contain rounded-2xl shadow-2xl ring-1 ring-white/10"
              />
            )}
          </div>
          <div className="p-6 bg-zinc-900 border-t border-white/10 flex justify-center">
            <Button variant="secondary" onClick={() => setDocumentViewer({ isOpen: false, url: "", label: "", isPdf: false })} className="rounded-2xl font-black px-10 h-12 shadow-premium border-none text-zinc-900">
              Fermer la vue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl dark:bg-zinc-950 p-0 overflow-hidden">
          <DialogHeader className="p-8 bg-zinc-950 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/20 blur-[50px] rounded-full -mr-10 -mt-10" />
            <div className="relative z-10 space-y-2">
              <DialogTitle className="text-3xl font-black tracking-tight text-white">
                Refuser {selectedDocType ? "le document" : "la vérification"}
              </DialogTitle>
              <DialogDescription className="text-zinc-400 font-bold">
                Indiquez la raison pour laquelle cet élément n'est pas conforme.
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="p-8 space-y-6 bg-white dark:bg-zinc-950">
            <div className="flex items-center gap-4 p-4 rounded-3xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
              <div className="h-12 w-12 rounded-2xl bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center">
                <UserIcon className="h-6 w-6 text-zinc-400" />
              </div>
              <div>
                <p className="font-black text-lg leading-none text-zinc-900 dark:text-white">{selectedUser?.first_name} {selectedUser?.last_name}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold mt-1">{selectedUser?.email}</p>
              </div>
            </div>

            {selectedDocType && (
              <Badge variant="outline" className="rounded-xl font-bold border-rose-200 text-rose-700 bg-rose-100 px-3 py-1 text-[10px] uppercase tracking-widest">
                Élément: {selectedDocType === 'id_front' ? "Pièce d'identité" : 'Justificatif Domicile'}
              </Badge>
            )}

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                <AlertCircle className="h-3 w-3" />
                Raison du refus (envoyée à l'investisseur)
              </label>
              <Textarea 
                placeholder="Ex: La photo est floue, le document est expiré, nom ne correspond pas..."
                className="rounded-3xl min-h-[150px] font-bold border-zinc-200 dark:border-zinc-700 focus:ring-rose-500 focus:border-rose-500 transition-all p-5 text-sm bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="p-8 pt-0 bg-white dark:bg-zinc-950 flex gap-3">
            <Button variant="ghost" onClick={() => setIsRejectDialogOpen(false)} className="flex-1 rounded-2xl font-black uppercase tracking-widest text-[10px] h-14 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white">Annuler</Button>
            <Button 
              onClick={handleReject} 
              disabled={reviewKycMutation.isPending || reviewDocMutation.isPending}
              className="flex-[2] rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest text-[10px] h-14 shadow-lg shadow-rose-200 transition-all hover:scale-[1.02]"
            >
              {reviewDocMutation.isPending || reviewKycMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KycManagement;
