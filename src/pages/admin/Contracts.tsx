import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminGetAllContracts, getAdminContractKPIs } from "@/services/adminService";
import { formatCurrency, exportToCsv, exportToPdf } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useDebounce } from "@/hooks/useDebounce";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit, FileText, CheckCircle, TrendingUp, DollarSign, LayoutGrid, List, FileDown, ChevronLeft, ChevronRight, RotateCcw, Filter, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog } from "@/components/ui/dialog";
import { EditContractDialog } from "@/components/admin/EditContractDialog";
import { AdminContractCard } from "@/components/admin/AdminContractCard";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";

type ContractData = Database['public']['Tables']['contracts']['Row'] & {
  first_name: string | null;
  last_name: string | null;
  email: string;
};

const PAGE_SIZE = 15;

const AdminContractsPage = () => {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [datePreset, setDatePreset] = useState("all");
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [isExporting, setIsExporting] = useState(false);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ContractData | null>(null);

  const { data: paginatedData, isLoading: isLoadingList } = useQuery({
    queryKey: ["allContracts", debouncedSearchQuery, statusFilter, page, dateFrom, dateTo],
    queryFn: () => adminGetAllContracts(debouncedSearchQuery, statusFilter, page, PAGE_SIZE, dateFrom, dateTo),
    placeholderData: { data: [], count: 0 },
  });

  const { data: kpis, isLoading: isLoadingKPIs } = useQuery({
    queryKey: ["adminContractKPIs", debouncedSearchQuery, statusFilter, dateFrom, dateTo],
    queryFn: () => getAdminContractKPIs(debouncedSearchQuery, statusFilter, dateFrom, dateTo),
  });

  const typedPaginatedData = paginatedData as unknown as { data: ContractData[], count: number };
  const contracts = typedPaginatedData?.data || [];
  const totalCount = typedPaginatedData?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const isLoading = isLoadingList || isLoadingKPIs;

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setDatePreset("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'refunded': return 'destructive';
      case 'pending_refund': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  const handleEditClick = (contract: ContractData) => {
    setSelectedContract(contract);
    setIsEditDialogOpen(true);
  };

  const handlePresetChange = (value: string) => {
    setDatePreset(value);
    const today = new Date();
    switch (value) {
      case "today":
        setDateFrom(format(startOfDay(today), "yyyy-MM-dd"));
        setDateTo(format(endOfDay(today), "yyyy-MM-dd"));
        break;
      case "week":
        setDateFrom(format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"));
        setDateTo(format(endOfDay(today), "yyyy-MM-dd"));
        break;
      case "month":
        setDateFrom(format(startOfMonth(today), "yyyy-MM-dd"));
        setDateTo(format(endOfDay(today), "yyyy-MM-dd"));
        break;
      default:
        setDateFrom("");
        setDateTo("");
        break;
    }
    setPage(1);
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const rpcResult = await adminGetAllContracts(debouncedSearchQuery, statusFilter, 1, 10000, dateFrom, dateTo) as any;
      const allContracts = (rpcResult?.data || []) as ContractData[];
      const headers = {
        id: "ID Contrat",
        client: "Client",
        email: "Email",
        amount: "Montant",
        currency: "Devise",
        status: "Statut",
        months_paid: "Mois Payés",
        duration_months: "Durée",
        total_profit_paid: "Profits Versés",
        start_date: "Date Début",
        end_date: "Date Fin"
      } as any;
      const dataForCsv = allContracts.map(c => ({
        ...c,
        client: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        start_date: format(new Date(c.start_date), "dd/MM/yyyy"),
        end_date: format(new Date(c.end_date), "dd/MM/yyyy"),
      }));
      exportToCsv(dataForCsv as any, headers, `contrats_${new Date().toISOString().split('T')[0]}.csv`);
      toast({ title: "Export réussi", description: `${allContracts.length} contrats exportés.` });
    } catch (error) {
      console.error("CSV Export failed:", error);
      toast({ variant: "destructive", title: "Erreur", description: "Échec de l'export." });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const rpcResult = await adminGetAllContracts(debouncedSearchQuery, statusFilter, 1, 10000, dateFrom, dateTo) as any;
      const allContracts = (rpcResult?.data || []) as ContractData[];
      const headers = {
        client: "Client",
        email: "Email",
        amount: "Montant",
        status: "Statut",
        progress: "Progression",
        start_date: "Date Début",
      } as any;
      const dataForPdf = allContracts.map(c => ({
        ...c,
        client: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        email: c.email,
        amount: formatCurrency(Number(c.amount), c.currency).replace(/\s/g, ''),
        status: c.status,
        progress: `${c.months_paid}/${c.duration_months} mois`,
        start_date: format(new Date(c.start_date), "dd/MM/yyyy"),
      }));

      const columnStyles = {
        0: { cellWidth: 40 }, // client
        1: { cellWidth: 45 }, // email
        2: { cellWidth: 25 }, // amount
        3: { cellWidth: 20 }, // status
        4: { cellWidth: 25 }, // progress
        5: { cellWidth: 20 }, // start_date
      };

      const totalAmount = allContracts.reduce((sum, c) => sum + Number(c.amount), 0);
      const totalProfit = allContracts.reduce((sum, c) => sum + Number(c.total_profit_paid || 0), 0);

      const summary = [
        { label: "Total Investi", value: formatCurrency(totalAmount, allContracts[0]?.currency || 'USD').replace(/\s/g, '') },
        { label: "Total Profits", value: formatCurrency(totalProfit, allContracts[0]?.currency || 'USD').replace(/\s/g, '') },
      ];

      exportToPdf(dataForPdf as any, headers, `contrats_${new Date().toISOString().split('T')[0]}.pdf`, "Liste des Contrats", columnStyles, summary);

      toast({ title: "Export PDF réussi", description: `${allContracts.length} contrats exportés.` });
    } catch (error) {
      console.error("PDF Export failed:", error);
      toast({ variant: "destructive", title: "Erreur", description: "Échec de l'export PDF." });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Gestion des Contrats</h1>
        <p className="text-muted-foreground">Consultez et filtrez tous les contrats de la plateforme.</p>
        {!isLoading && totalCount > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <span className="text-sm text-muted-foreground">Contrats trouvés:</span>
            <span className="text-base font-bold text-blue-700">{totalCount}</span>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">Total Contrats</div>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">
              {kpis?.total_count || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Sur la plateforme
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">Contrats Actifs</div>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">
              {kpis?.active_count || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              En cours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">Valeur Totale</div>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(kpis?.total_investment || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Investissement total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">Profits Versés</div>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(kpis?.total_profits_paid || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Déjà distribués
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">Profits Disponibles</div>
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </div>
            <div className="text-2xl font-bold text-orange-700">
              {formatCurrency(kpis?.total_profits_available || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Non retirés
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">Profits Retirés</div>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-700">
              {formatCurrency(kpis?.total_profits_withdrawn || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Déjà retirés
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Control Bar: Filters, View Toggle, Export */}
      <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">

        {/* Left: Search & Filter */}
        <div className="flex flex-col md:flex-row gap-2 w-full xl:w-auto">
          <Input
            placeholder="Rechercher par nom, email, ID..."
            className="w-full md:w-[250px]"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          />
          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="completed">Terminé</SelectItem>
              <SelectItem value="refunded">Remboursé</SelectItem>
              <SelectItem value="pending_refund">Demande Remb.</SelectItem>
              <SelectItem value="cancelled">Annulé</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Center/Right: Date Filters */}
        <div className="flex flex-col md:flex-row gap-2 w-full xl:w-auto items-center">
          <Select value={datePreset} onValueChange={handlePresetChange}>
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder="Période" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tout l'historique</SelectItem>
              <SelectItem value="today">Aujourd'hui</SelectItem>
              <SelectItem value="week">Cette semaine</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="custom">Personnalisé</SelectItem>
            </SelectContent>
          </Select>
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-[130px]" />
              <span className="text-muted-foreground">-</span>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-[130px]" />
            </div>
          )}
        </div>

        {/* Right: Actions (Export, View) */}
        <div className="flex gap-2 w-full xl:w-auto justify-end">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            title={viewMode === 'list' ? "Vue Grille" : "Vue Liste"}
          >
            {viewMode === 'list' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isExporting || totalCount === 0}
          >
            <FileDown className="h-4 w-4 mr-2" />
            {isExporting ? "Export..." : "CSV"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={isExporting || totalCount === 0}
          >
            <FileDown className="h-4 w-4 mr-2" />
            {isExporting ? "Export..." : "PDF"}
          </Button>
        </div>
      </div>


      {/* Content Area */}
      {viewMode === 'list' ? (
        <div className="border border-border/50 rounded-lg bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50 hover:bg-secondary/60">
                <TableHead>Utilisateur</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Progression</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(6)].map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : contracts.length > 0 ? (
                contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell>
                      <div className="font-medium">{`${contract.first_name || ''} ${contract.last_name || ''}`.trim()}</div>
                      <div className="text-sm text-muted-foreground">{contract.email}</div>
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(Number(contract.amount), contract.currency)}</TableCell>
                    <TableCell><Badge variant={getStatusVariant(contract.status)} className="capitalize">{contract.status}</Badge></TableCell>
                    <TableCell>
                      <div className="w-[100px]">
                        <div className="text-xs text-muted-foreground mb-1">{contract.months_paid}/{contract.duration_months} mois</div>
                        <Progress value={(contract.months_paid / contract.duration_months) * 100} className="h-1.5" />
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>Du: {format(new Date(contract.start_date), "dd/MM/yyyy", { locale: fr })}</div>
                      <div>Au: {format(new Date(contract.end_date), "dd/MM/yyyy", { locale: fr })}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-secondary"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEditClick(contract)}>
                            <Edit className="mr-2 h-4 w-4" /> Modifier
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    Aucun résultat trouvé.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div >
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isLoading ? (
            [...Array(8)].map((_, i) => <Skeleton key={i} className="h-[250px] rounded-lg" />)
          ) : contracts.length > 0 ? (
            contracts.map(contract => (
              <AdminContractCard
                key={contract.id}
                contract={contract}
                onEdit={handleEditClick}
              />
            ))
          ) : (
            <div className="col-span-full py-12 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <div className="text-muted-foreground">Aucun contrat trouvé pour ces critères.</div>
            </div>
          )}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              {page > 1 ? (
                <PaginationPrevious onClick={() => setPage(prev => Math.max(1, prev - 1))} className="cursor-pointer" />
              ) : (
                <Button variant="ghost" size="default" disabled className="gap-1 pl-2.5 text-muted-foreground">
                  <ChevronLeft className="h-4 w-4" />
                  <span>Précédent</span>
                </Button>
              )}
            </PaginationItem>

            <PaginationItem>
              <span className="text-sm font-medium p-2 text-muted-foreground">
                Page <span className="text-foreground">{page}</span> sur <span className="text-foreground">{totalPages}</span>
              </span>
            </PaginationItem>

            <PaginationItem>
              {page < totalPages ? (
                <PaginationNext onClick={() => setPage(prev => Math.min(totalPages, prev + 1))} className="cursor-pointer" />
              ) : (
                <Button variant="ghost" size="default" disabled className="gap-1 pr-2.5 text-muted-foreground">
                  <span>Suivant</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {
        selectedContract && (
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <EditContractDialog
              contract={selectedContract}
              open={isEditDialogOpen}
              onOpenChange={setIsEditDialogOpen}
            />
          </Dialog>
        )
      }
    </div >
  );
};

export default AdminContractsPage;