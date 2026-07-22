import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserDetails, sendAdminNotification, getUserTransactionsPaginated } from "@/services/adminService";
import { getAuditLogs, formatAuditAction } from "@/services/auditService";
import { useToast } from "@/components/ui/use-toast";
import { DeductServiceFeeDialog } from "@/components/admin/DeductServiceFeeDialog";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  Dialog,
  DialogTrigger
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Wallet,
  FileText,
  History,
  User,
  Mail,
  Phone,
  Calendar,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Clock,
  BellRing,
  Send,
  Loader2
} from "lucide-react";

interface UserDetailDialogProps {
  userId: string;
}

export const UserDetailDialog = ({ userId }: UserDetailDialogProps) => {
  const [activeTab, setActiveTab] = useState("profile");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationPriority, setNotificationPriority] = useState("medium");
  const [txPage, setTxPage] = useState(1);
  const TX_PAGE_SIZE = 10;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user details
  const { data, isLoading, isError } = useQuery({
    queryKey: ["userDetails", userId],
    queryFn: () => getUserDetails(userId),
    enabled: !!userId,
  });

  // Fetch paginated transactions for this user
  const { data: txData, isLoading: isLoadingTx } = useQuery({
    queryKey: ["userTransactions", userId, txPage],
    queryFn: () => getUserTransactionsPaginated(userId, txPage, TX_PAGE_SIZE),
    enabled: !!userId && activeTab === "transactions",
  });

  // Fetch audit logs for this user
  const { data: auditLogs, isLoading: isLoadingAudit } = useQuery({
    queryKey: ["userAuditLogs", userId],
    queryFn: () => getAuditLogs({ entityId: userId, limit: 20 }),
    enabled: !!userId && activeTab === "history",
  });

  const formatDate = (date: string) => {
    return format(new Date(date), "dd MMM yyyy", { locale: fr });
  };

  const formatDateTime = (date: string) => {
    return format(new Date(date), "dd MMM yyyy à HH:mm", { locale: fr });
  };

  const sendNotificationMutation = useMutation({
    mutationFn: sendAdminNotification,
    onSuccess: () => {
      toast({ title: "Notification envoyée", description: "L'utilisateur a été notifié avec succès." });
      setNotificationMessage("");
      setNotificationPriority("medium");
      // Optionally invalidate logs if we logged this action
      queryClient.invalidateQueries({ queryKey: ["userAuditLogs", userId] });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    }
  });

  const handleSendNotification = () => {
    if (!notificationMessage.trim()) return;

    sendNotificationMutation.mutate({
      userId,
      message: notificationMessage,
      priority: notificationPriority
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      completed: "bg-blue-100 text-blue-800",
      pending: "bg-yellow-100 text-yellow-800",
      failed: "bg-red-100 text-red-800",
      refunded: "bg-gray-100 text-gray-800",
    };
    return <Badge className={variants[status] || "bg-gray-100"}>{status}</Badge>;
  };

  const getTransactionDetails = (type: string) => {
    switch (type) {
      case "deposit":
        return { label: "Dépôt", icon: <ArrowDownRight className="h-4 w-4 text-green-600" />, color: "text-green-600", prefix: "+" };
      case "withdrawal":
        return { label: "Retrait", icon: <ArrowUpRight className="h-4 w-4 text-red-600" />, color: "text-red-600", prefix: "-" };
      case "reinvestment":
        return { label: "Réinvestissement", icon: <TrendingUp className="h-4 w-4 text-indigo-600" />, color: "text-indigo-600", prefix: "-" };
      case "transfer":
        return { label: "Transfert (Cap.)", icon: <Wallet className="h-4 w-4 text-cyan-600" />, color: "text-cyan-600", prefix: "-" };
      case "profit":
        return { label: "Profit versé", icon: <ArrowDownRight className="h-4 w-4 text-emerald-600" />, color: "text-emerald-600", prefix: "+" };
      case "investment":
        return { label: "Investissement", icon: <FileText className="h-4 w-4 text-blue-600" />, color: "text-blue-600", prefix: "-" };
      default:
        return { label: type, icon: <TrendingUp className="h-4 w-4 text-zinc-600" />, color: "text-zinc-600", prefix: "" };
    }
  };

  if (isLoading) {
    return (
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="space-y-4 p-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </DialogContent>
    );
  }

  if (isError || !data) {
    return (
      <DialogContent className="sm:max-w-3xl">
        <div className="text-center py-8 text-muted-foreground">
          Impossible de charger les détails de l'utilisateur.
        </div>
      </DialogContent>
    );
  }

  const { profile, wallet, contracts, transactions, totalReinvested, totalTransferred, totalWithdrawn, totalDeposits, totalProfitsPaid } = data;
  const activeContracts = contracts?.filter((c: any) => c.status === "active" || c.status === "paused") || [];
  const totalInvested = activeContracts.reduce((sum: number, c: any) => sum + Number(c.amount), 0);

  // Calculate profile completion status
  const isProfileComplete =
    profile?.first_name && profile?.first_name.trim() !== '' &&
    profile?.last_name && profile?.last_name.trim() !== '' &&
    profile?.phone && profile?.phone.trim() !== '' &&
    profile?.birth_date;

  // Calculate total profits generated from contracts
  const totalProfitsGenerated = contracts?.reduce((sum: number, c: any) => sum + Number(c.total_profit_paid || 0), 0) || 0;

  return (
    <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span>{profile?.first_name} {profile?.last_name}</span>
              {profile?.post_nom && <span className="text-muted-foreground ml-1">({profile.post_nom})</span>}
            </div>
            {profile?.kyc_status === 'verified' && <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 ml-2">KYC Validé</Badge>}
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                Facturer Service
              </Button>
            </DialogTrigger>
            <DeductServiceFeeDialog userId={userId} userEmail={profile?.email || ""} />
          </Dialog>
        </DialogTitle>
        <DialogDescription>Vue complète du profil et de l'activité de l'utilisateur</DialogDescription>
      </DialogHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-4">
          <TabsTrigger value="profile" className="text-xs">
            <User className="h-4 w-4 mr-1" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="contracts" className="text-xs">
            <FileText className="h-4 w-4 mr-1" />
            Contrats
          </TabsTrigger>
          <TabsTrigger value="transactions" className="text-xs">
            <TrendingUp className="h-4 w-4 mr-1" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs">
            <History className="h-4 w-4 mr-1" />
            Historique
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs">
            <BellRing className="h-4 w-4 mr-1" />
            Notifier
          </TabsTrigger>
        </TabsList>

        {/* PROFIL TAB */}
        <TabsContent value="profile" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3 p-4 rounded-lg bg-muted/50">
              <h4 className="font-semibold text-sm text-muted-foreground">Informations Personnelles</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{profile?.first_name} {profile?.last_name}</span>
                </div>
                {profile?.post_nom && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Post-nom: {profile.post_nom}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{profile?.email}</span>
                </div>
                {profile?.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{profile.phone}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 p-4 rounded-lg bg-muted/50">
              <h4 className="font-semibold text-sm text-muted-foreground">Compte</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Inscrit le {profile?.created_at ? formatDate(profile.created_at) : "N/A"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant={isProfileComplete ? "default" : "secondary"}>
                    {isProfileComplete ? "Profil complet" : "Profil incomplet"}
                  </Badge>
                </div>
                {profile?.banned_until && new Date(profile.banned_until) > new Date() && (
                  <Badge variant="destructive">Compte banni</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-100">
              <p className="text-xl font-bold text-blue-700">{activeContracts.length}</p>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Contrats actifs</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-50 border border-green-100">
              <p className="text-xl font-bold text-green-700">{formatCurrency(totalInvested, wallet?.currency)}</p>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Total investi</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-purple-50 border border-purple-100">
              <p className="text-xl font-bold text-purple-700">{formatCurrency(Number(wallet?.profit_balance || 0), wallet?.currency)}</p>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Profit actuel</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-50 border border-red-100">
              <p className="text-xl font-bold text-red-700">
                {formatCurrency(
                  transactions
                    ?.filter((t: any) => t.type === 'service_fee' && t.status === 'completed')
                    ?.reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0,
                  wallet?.currency
                )}
              </p>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Achat de services</p>
            </div>
          </div>

          {/* Second row of Stats: Reinvested & Transferred & Debt */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-indigo-50 border border-indigo-100">
              <p className="text-xl font-bold text-indigo-700">{formatCurrency(totalReinvested, wallet?.currency)}</p>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Profits réinvestis</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-cyan-50 border border-cyan-100">
              <p className="text-xl font-bold text-cyan-700">{formatCurrency(totalTransferred, wallet?.currency)}</p>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Profits transférés (Cap.)</p>
            </div>
            <div className={`text-center p-3 rounded-lg border ${Number(wallet?.debt_balance || 0) > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
              <p className={`text-xl font-bold ${Number(wallet?.debt_balance || 0) > 0 ? 'text-red-700' : 'text-gray-700'}`}>
                {formatCurrency(Number(wallet?.debt_balance || 0), wallet?.currency)}
              </p>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Dette Virtuelle</p>
            </div>
          </div>

          {/* Third row of Stats: Total Deposits & Total Profits Paid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 rounded-lg bg-emerald-50 border border-emerald-100">
              <p className="text-xl font-bold text-emerald-700">{formatCurrency(totalDeposits, wallet?.currency)}</p>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Total des Dépôts</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-50 border border-amber-100">
              <p className="text-xl font-bold text-amber-700">{formatCurrency(totalProfitsPaid, wallet?.currency)}</p>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Total Profits Versés</p>
            </div>
          </div>
        </TabsContent>

        {/* CONTRACTS TAB */}
        <TabsContent value="contracts" className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded bg-muted/50 border">
              <p className="text-[10px] text-muted-foreground uppercase">Total Investi</p>
              <p className="text-lg font-bold">{formatCurrency(totalInvested, wallet?.currency)}</p>
            </div>
            <div className="p-3 rounded bg-muted/50 border">
              <p className="text-[10px] text-muted-foreground uppercase">Profits</p>
              <p className="text-lg font-bold text-green-600">+{formatCurrency(totalProfitsGenerated, wallet?.currency)}</p>
            </div>
            <div className="p-3 rounded bg-muted/50 border">
              <p className="text-[10px] text-muted-foreground uppercase">Actifs</p>
              <p className="text-lg font-bold">{activeContracts.length}</p>
            </div>
          </div>

          {contracts && contracts.length > 0 ? (
            <div className="space-y-3">
              {contracts.map((contract: any) => {
                const progress = (contract.months_paid / contract.duration_months) * 100;

                return (
                  <div key={contract.id} className="p-4 rounded border bg-card/50 relative">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">Contrat #{contract.id.substring(0, 8)}</span>
                          {contract.is_insured && (
                            <Badge variant="outline" className="text-[10px] py-0 h-4">
                              <Shield className="h-2.5 w-2.5 mr-0.5" />
                              Assuré
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDate(contract.start_date)} → {formatDate(contract.end_date)}
                        </p>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(contract.status)}
                        <p className="text-base font-bold mt-1">{formatCurrency(Number(contract.amount), wallet?.currency)}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">Progression</span>
                        <span>{contract.months_paid} / {contract.duration_months} mois</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-dotted">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-tight">Profits versés</span>
                      <span className="text-sm font-semibold text-green-600">+{formatCurrency(Number(contract.total_profit_paid || 0), wallet?.currency)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/30 rounded-xl border-2 border-dashed">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p className="text-muted-foreground font-medium">Aucun contrat trouvé</p>
            </div>
          )}
        </TabsContent>

        {/* TRANSACTIONS TAB */}
        <TabsContent value="transactions" className="space-y-4">
          {isLoadingTx ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : txData?.transactions && txData.transactions.length > 0 ? (
            <>
              <div className="space-y-2">
                {txData.transactions.map((tx: any) => {
                  const details = getTransactionDetails(tx.type);
                  return (
                    <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex items-center gap-3">
                        {details.icon}
                        <div>
                          <p className="font-medium capitalize">{details.label}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(tx.created_at)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${details.color}`}>
                          {details.prefix}{formatCurrency(Number(tx.amount), wallet?.currency)}
                        </p>
                        {getStatusBadge(tx.status)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between pt-4 border-t mt-4">
                <div className="text-xs text-muted-foreground">
                  Page {txPage} sur {Math.ceil(txData.totalCount / TX_PAGE_SIZE) || 1} ({txData.totalCount} transactions)
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setTxPage(p => Math.max(1, p - 1))}
                    disabled={txPage === 1}
                    className="h-8 text-xs"
                  >
                    Précédent
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setTxPage(p => p + 1)}
                    disabled={txPage >= Math.ceil(txData.totalCount / TX_PAGE_SIZE)}
                    className="h-8 text-xs"
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
              Aucune transaction
            </div>
          )}
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="space-y-4">
          {isLoadingAudit ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : auditLogs && auditLogs.length > 0 ? (
            <div className="space-y-2">
              {auditLogs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <Clock className="h-4 w-4 text-muted-foreground mt-1" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{formatAuditAction(log.action)}</p>
                    <p className="text-xs text-muted-foreground">
                      Par {log.user_email || "Système"} • {formatDateTime(log.created_at)}
                    </p>
                    {log.new_values && (
                      <div className="mt-2 p-2 rounded bg-muted text-[10px] font-mono space-y-1 overflow-x-auto">
                        {log.old_values && (
                          <div className="flex gap-2">
                            <span className="text-red-500">OLD:</span>
                            <span>{JSON.stringify(log.old_values)}</span>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <span className="text-green-600">NEW:</span>
                          <span>{JSON.stringify(log.new_values)}</span>
                        </div>
                        {log.metadata && (
                          <div className="flex gap-2 text-blue-600 border-t pt-1 mt-1">
                            <span className="font-bold">INFO:</span>
                            <span>{JSON.stringify(log.metadata)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
              Aucun historique d'action pour cet utilisateur
            </div>
          )}
        </TabsContent>

        {/* NOTIFICATIONS TAB */}
        <TabsContent value="notifications" className="space-y-4">
          <div className="p-6 border rounded-lg bg-card shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <BellRing className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">Envoyer une notification directe</h4>
                <p className="text-xs text-muted-foreground">Cette notification apparaîtra dans la cloche de l'utilisateur.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="priority">Priorité du message</Label>
                <Select value={notificationPriority} onValueChange={setNotificationPriority}>
                  <SelectTrigger id="priority" className="w-[180px]">
                    <SelectValue placeholder="Choisir la priorité" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">🟡 Basse (Info)</SelectItem>
                    <SelectItem value="medium">🔵 Normale</SelectItem>
                    <SelectItem value="high">🟠 Haute (Important)</SelectItem>
                    <SelectItem value="urgent">🔴 Urgent (Action requise)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Votre message ici... (ex: Veuillez mettre à jour votre document d'identité)"
                  className="min-h-[120px]"
                  value={notificationMessage}
                  onChange={(e) => setNotificationMessage(e.target.value)}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSendNotification}
                  disabled={!notificationMessage.trim() || sendNotificationMutation.isPending}
                  className="gap-2"
                >
                  {sendNotificationMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Envoyer la notification
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-semibold mb-1 flex items-center gap-2">
              <Clock className="h-4 w-4" /> Note sur les délais
            </p>
            <p>La notification apparaîtra instantanément (moins de 10 secondes) sur l'interface de l'utilisateur s'il est connecté.</p>
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter className="mt-4 border-t pt-4">
        <DialogClose asChild>
          <Button variant="secondary">Fermer</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
};
