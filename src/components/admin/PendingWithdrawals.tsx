import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPendingWithdrawals, approveWithdrawal, rejectWithdrawal, getTransactionMetadata } from "@/services/adminService";
import { uploadWithdrawalProof } from "@/services/withdrawalProofService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, MoreHorizontal, Eye, Upload, CheckCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CreditUserDialog } from "./CreditUserDialog";
import { usePendingWithdrawalsRealtime } from "@/hooks/useRealtimeSync";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type ActionType = "approve" | "reject";
interface DialogState { isOpen: boolean; action?: ActionType; transactionId?: string; userName?: string; }
type SelectedUser = { id: string; email: string; };

export const PendingWithdrawals = () => {
    usePendingWithdrawalsRealtime();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [dialogState, setDialogState] = useState<DialogState>({ isOpen: false });
    const [rejectionReason, setRejectionReason] = useState("");
    const [isCreditUserOpen, setIsCreditUserOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);

    // Metadata state
    const [metadataCache, setMetadataCache] = useState<Record<string, any[]>>({});
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [selectedMetadata, setSelectedMetadata] = useState<any[]>([]);

    // Upload proof state
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [proofPreview, setProofPreview] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    const { data: withdrawals, isLoading } = useQuery({
        queryKey: ["pendingWithdrawals"],
        queryFn: getPendingWithdrawals,
    });

    // Fetch metadata for all withdrawals
    useEffect(() => {
        if (withdrawals) {
            withdrawals.forEach(async (w: any) => {
                if (!metadataCache[w.id]) {
                    const metadata = await getTransactionMetadata(w.id);
                    setMetadataCache(prev => ({ ...prev, [w.id]: metadata }));
                }
            });
        }
    }, [withdrawals]);

    const formatPaymentDetails = (metadata: any[]) => {
        if (!metadata || metadata.length === 0) return "Aucun détail";

        const findValue = (keyStart: string) => metadata.find(m => m.field_key.startsWith(keyStart))?.field_value;

        const recipientNumber = findValue('recipient_number');
        if (recipientNumber) return `📱 ${recipientNumber}`;

        const wallet = findValue('recipient_wallet');
        if (wallet) return `💰 ${wallet.substring(0, 8)}...`;

        const binanceId = findValue('recipient_binance_id');
        if (binanceId) return `🔶 ID: ${binanceId}`;

        const account = findValue('recipient_account');
        const name = findValue('recipient_account_name');
        if (account) return `🏦 ${account} (${name || '?'})`;

        const fullName = findValue('recipient_full_name');
        const country = findValue('recipient_country');
        if (fullName) return `✈️ ${fullName} (${country})`;

        return "Détails disponibles";
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast({ variant: "destructive", title: "Erreur", description: "Seules les images sont acceptées." });
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast({ variant: "destructive", title: "Erreur", description: "Fichier trop volumineux (max 5MB)." });
            return;
        }

        setProofFile(file);

        const reader = new FileReader();
        reader.onloadend = () => setProofPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const approveMutation = useMutation({
        mutationFn: async ({ transactionId, proofUrl }: { transactionId: string; proofUrl: string }) => {
            return approveWithdrawal(transactionId, proofUrl);
        },
        onSuccess: () => {
            toast({ title: "Succès", description: "Retrait approuvé et preuve envoyée à l'utilisateur." });
            queryClient.invalidateQueries({ queryKey: ['pendingWithdrawals'] });
            setUploadDialogOpen(false);
            setProofFile(null);
            setProofPreview(null);
        },
        onError: (error: Error) => {
            toast({ variant: "destructive", title: "Erreur", description: error.message });
        },
    });

    const rejectMutation = useMutation({
        mutationFn: ({ transactionId, reason }: { transactionId: string; reason: string }) => rejectWithdrawal(transactionId, reason),
        onSuccess: () => {
            toast({ title: "Succès", description: "Retrait rejeté." });
            queryClient.invalidateQueries({ queryKey: ['pendingWithdrawals'] });
            closeDialog();
        },
        onError: (error: Error) => toast({ variant: "destructive", title: "Erreur", description: error.message }),
    });

    const openDialog = (action: ActionType, withdrawal: any) => {
        if (action === "approve") {
            setSelectedWithdrawal(withdrawal);
            setUploadDialogOpen(true);
        } else {
            setDialogState({ isOpen: true, action, transactionId: withdrawal.id, userName: withdrawal.profile?.full_name });
        }
    };

    const openDetailsDialog = (metadata: any[]) => {
        setSelectedMetadata(metadata);
        setDetailsDialogOpen(true);
    };

    const closeDialog = () => {
        setDialogState({ isOpen: false });
        setRejectionReason("");
    };

    const handleReject = () => {
        if (!dialogState.transactionId) return;
        if (!rejectionReason.trim()) {
            toast({ variant: "destructive", title: "Erreur", description: "La raison du rejet est obligatoire." });
            return;
        }
        rejectMutation.mutate({ transactionId: dialogState.transactionId, reason: rejectionReason });
    };

    const handleApproveWithProof = async () => {
        if (!selectedWithdrawal || !proofFile) {
            toast({ variant: "destructive", title: "Erreur", description: "La preuve de transfert est obligatoire." });
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => Math.min(prev + 10, 90));
            }, 200);

            const proofUrl = await uploadWithdrawalProof(proofFile, selectedWithdrawal.id);

            clearInterval(progressInterval);
            setUploadProgress(100);

            await approveMutation.mutateAsync({ transactionId: selectedWithdrawal.id, proofUrl });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Erreur d'upload", description: error.message });
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const handleCopyToClipboard = (text: string, label: string = "Texte") => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: "Copié!", description: `${label} copié dans le presse-papiers.` });
        });
    };

    const isActionPending = approveMutation.isPending || rejectMutation.isPending;

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Retraits en Attente</CardTitle>
                    <CardDescription>Approuvez ou rejetez les demandes de retrait. <strong>La preuve de transfert est OBLIGATOIRE.</strong></CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Utilisateur</TableHead>
                                    <TableHead>Méthode</TableHead>
                                    <TableHead>Détails de Paiement</TableHead>
                                    <TableHead className="text-right">Montant</TableHead>
                                    <TableHead className="text-center">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="text-center">Chargement...</TableCell></TableRow>
                                ) : withdrawals && withdrawals.length > 0 ? (
                                    withdrawals.map((w: any) => {
                                        const metadata = metadataCache[w.id] || [];
                                        const formattedDetails = formatPaymentDetails(metadata);

                                        return (
                                            <TableRow key={w.id}>
                                                <TableCell>{format(new Date(w.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{w.profile?.full_name || "Nom non défini"}</div>
                                                    <div className="text-sm text-muted-foreground">{w.profile?.email}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="capitalize">
                                                        {w.method?.replace(/_/g, ' ') || 'N/A'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-sm">{formattedDetails}</span>
                                                        {metadata.length > 0 && (
                                                            <>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopyToClipboard(formattedDetails, "Détails")}>
                                                                    <Copy className="h-3 w-3" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openDetailsDialog(metadata)}>
                                                                    <Eye className="h-3 w-3" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">{formatCurrency(Number(w.amount), w.currency)}</TableCell>
                                                <TableCell className="text-center">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            <DropdownMenuItem onClick={() => openDialog("approve", w)}>
                                                                <Upload className="mr-2 h-4 w-4" />
                                                                Approuver (+ Preuve)
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => openDialog("reject", w)}>Rejeter</DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => { setSelectedUser({ id: w.user_id, email: w.profile?.email || 'N/A' }); setIsCreditUserOpen(true); }}>
                                                                Créditer l'utilisateur
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="p-0">
                                            <div className="text-center py-16 bg-gradient-to-br from-red-50 to-rose-50 rounded-lg m-4">
                                                <div className="text-6xl mb-4">✅</div>
                                                <h3 className="text-2xl font-semibold mb-2 text-red-900">Tous les retraits traités !</h3>
                                                <p className="text-muted-foreground">Aucun retrait en attente de validation</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Dialog Upload Preuve (OBLIGATOIRE) */}
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>📑 Approuver le Retrait</DialogTitle>
                        <DialogDescription>
                            Upload de la preuve de transfert <strong className="text-red-600">OBLIGATOIRE</strong>
                        </DialogDescription>
                    </DialogHeader>

                    {selectedWithdrawal && (
                        <div className="space-y-4">
                            <div className="bg-muted p-4 rounded-lg">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="text-muted-foreground">Utilisateur :</div>
                                    <div className="font-medium">{selectedWithdrawal.profile?.full_name}</div>
                                    <div className="text-muted-foreground">Montant :</div>
                                    <div className="font-bold text-green-600">{formatCurrency(Number(selectedWithdrawal.amount))}</div>
                                    <div className="text-muted-foreground">Méthode :</div>
                                    <div>{selectedWithdrawal.method?.replace(/_/g, ' ')}</div>
                                    {/* Afficher les détails de paiement ici aussi */}
                                    <div className="text-muted-foreground">Destination :</div>
                                    <div className="font-mono text-xs break-all">
                                        {formatPaymentDetails(metadataCache[selectedWithdrawal.id] || [])}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="proof">Preuve de Transfert <span className="text-red-600">*</span></Label>
                                <Input
                                    id="proof"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileSelect}
                                    disabled={isUploading}
                                />
                                <p className="text-xs text-muted-foreground">Formats acceptés : JPEG, PNG, WebP (max 5MB)</p>
                            </div>

                            {proofPreview && (
                                <div className="border rounded-lg p-2">
                                    <img src={proofPreview} alt="Aperçu" className="w-full h-auto rounded" />
                                </div>
                            )}

                            {isUploading && (
                                <div className="space-y-2">
                                    <Progress value={uploadProgress} />
                                    <p className="text-xs text-center text-muted-foreground">Upload en cours... {uploadProgress}%</p>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUploadDialogOpen(false)} disabled={isUploading}>
                            Annuler
                        </Button>
                        <Button
                            onClick={handleApproveWithProof}
                            disabled={!proofFile || isUploading}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {isUploading ? "Upload..." : <><CheckCircle className="mr-2 h-4 w-4" /> Approuver</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog Détails Paiement */}
            <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Détails Complets du Paiement</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {selectedMetadata.map((meta, index) => (
                            <div key={index} className="flex justify-between items-center border-b pb-2">
                                <span className="font-medium text-sm text-muted-foreground">{meta.field_key}</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm">{meta.field_value}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopyToClipboard(meta.field_value, meta.field_key)}>
                                        <Copy className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog Rejet */}
            <AlertDialog open={dialogState.isOpen && dialogState.action === "reject"} onOpenChange={closeDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Rejeter le Retrait</AlertDialogTitle>
                        <AlertDialogDescription>
                            Êtes-vous sûr de vouloir rejeter la demande de retrait de <strong>{dialogState.userName}</strong> ?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="grid gap-2 py-4">
                        <Label htmlFor="reason">Raison du rejet</Label>
                        <Input id="reason" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Ex: Informations de paiement invalides" />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={closeDialog} disabled={isActionPending}>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReject} disabled={isActionPending}>
                            {isActionPending ? "En cours..." : "Confirmer"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {selectedUser && (
                <CreditUserDialog userId={selectedUser.id} userEmail={selectedUser.email} open={isCreditUserOpen} onOpenChange={setIsCreditUserOpen} />
            )}
        </>
    );
};
