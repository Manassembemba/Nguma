import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getInvestorsList } from "@/services/adminService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";
import { MoreHorizontal, FileDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserDetailDialog } from "@/components/admin/UserDetailDialog";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Define types based on what the service returns
type Contract = {
  status: string;
};
type Wallet = {
  total_balance: number;
  invested_balance: number;
  profit_balance: number;
  currency: string;
};
type Investor = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  post_nom: string | null;
  email: string;
  wallet: Wallet | null;
  contracts: Contract[];
};

const getInvestorStatus = (contracts: Contract[]): "Active" | "Inactive" | "New" => {
  const hasActiveContract = contracts.some(c => c.status === 'active');
  if (hasActiveContract) return "Active";
  if (contracts.length > 0) return "Inactive";
  return "New";
};

const PnlCell = ({ wallet }: { wallet: Wallet | null }) => {
  if (!wallet || !wallet.invested_balance || Number(wallet.invested_balance) === 0) {
    return <div className="text-text-secondary">N/A</div>;
  }

  const pnl = (Number(wallet.profit_balance) / Number(wallet.invested_balance)) * 100;
  const isPositive = pnl >= 0;

  return (
    <div>
      <div className={`w-full bg-opacity-20 rounded-full h-2 ${isPositive ? 'bg-primary' : 'bg-destructive'}`}>
        <div className={`h-2 rounded-full ${isPositive ? 'bg-primary' : 'bg-destructive'}`} style={{ width: `${Math.min(Math.abs(pnl), 100)}%` }}></div>
      </div>
      <div className={`text-xs mt-1 ${isPositive ? 'text-primary' : 'text-destructive'}`}>
        {isPositive ? '+' : ''}{pnl.toFixed(1)}%
      </div>
    </div>
  );
};

const StatusCell = ({ contracts }: { contracts: Contract[] }) => {
  const status = getInvestorStatus(contracts);
  const variant = status === 'Active' ? 'bg-primary/20 text-primary' : status === 'Inactive' ? 'secondary' : 'outline';
  return <Badge className={variant}>{status}</Badge>;
};

const PAGE_SIZE = 10;

export const InvestorListTable = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedInvestorId, setSelectedInvestorId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ data: Investor[], count: number }>({ 
    queryKey: ["investorsList", debouncedSearchQuery, page],
    queryFn: () => getInvestorsList(debouncedSearchQuery, page, PAGE_SIZE),
  });

  const investors = data?.data || [];
  const totalCount = data?.count || 0;
  const pageCount = Math.ceil(totalCount / PAGE_SIZE);

  const handleExport = async () => {
    setIsExporting(true);
    toast({ title: "Exportation en cours...", description: "Récupération de toutes les données des investisseurs." });

    try {
      const { data: allInvestors } = await getInvestorsList(debouncedSearchQuery, 1, totalCount > 0 ? totalCount : PAGE_SIZE);

      const csvHeader = "Nom Complet,Email,Solde Total,Solde Investi,Solde Profits,Devise,Statut\n";
      const csvRows = allInvestors.map(investor => {
        const fullName = `${investor.first_name || ''} ${investor.last_name || ''}`.trim();
        const email = investor.email || '';
        const totalBalance = investor.wallet?.total_balance || 0;
        const investedBalance = investor.wallet?.invested_balance || 0;
        const profitBalance = investor.wallet?.profit_balance || 0;
        const currency = investor.wallet?.currency || 'USD';
        const status = getInvestorStatus(investor.contracts);
        
        return `"${fullName.replace(/"/g, '""')}","${email}",${totalBalance},${investedBalance},${profitBalance},${currency},${status}\n`;
      });

      const csvContent = csvHeader + csvRows.join('');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `investisseurs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: "Succès", description: "Exportation des investisseurs terminée." });
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur d'exportation", description: "Impossible de générer le fichier CSV." });
    } finally {
      setIsExporting(false);
    }
  };

  const filteredInvestors = investors.filter(investor => {
    if (statusFilter === 'all') return true;
    return getInvestorStatus(investor.contracts) === statusFilter;
  });

  return (
    <>
      <div className="lg:col-span-2 flex flex-col rounded-lg bg-background-card border border-white/10 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Investors</h3>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-background-dark border-white/10">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="Active">Actif</SelectItem>
                <SelectItem value="Inactive">Inactif</SelectItem>
                <SelectItem value="New">Nouveau</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">search</span>
              <Input 
                className="bg-background-dark border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-primary focus:border-primary w-64"
                placeholder="Search investor..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={handleExport} disabled={isExporting}>
              <FileDown className="mr-2 h-4 w-4" />
              {isExporting ? "Exportation..." : "Exporter"}
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto flex-grow">
          <Table className="w-full text-left text-sm">
            <TableHeader className="border-b border-white/10 text-text-secondary uppercase">
              <TableRow>
                <TableHead className="p-3">Name</TableHead>
                <TableHead className="p-3">Balance</TableHead>
                <TableHead className="p-3">PNL %</TableHead>
                <TableHead className="p-3">Status</TableHead>
                <TableHead className="p-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center">Chargement...</TableCell></TableRow>
              ) : filteredInvestors.length > 0 ? (
                filteredInvestors.map((investor) => (
                  <TableRow key={investor.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                    <TableCell className="p-3">
                      <div className="font-medium text-text-primary">{`${investor.first_name || ''} ${investor.last_name || ''}`.trim() || "N/A"}</div>
                      <div className="text-text-secondary text-xs">{investor.email}</div>
                    </TableCell>
                    <TableCell className="p-3">
                      {investor.wallet ? formatCurrency(Number(investor.wallet.total_balance), investor.wallet.currency) : 'N/A'}
                    </TableCell>
                    <TableCell className="p-3"><PnlCell wallet={investor.wallet} /></TableCell>
                    <TableCell className="p-3"><StatusCell contracts={investor.contracts} /></TableCell>
                    <TableCell className="p-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setSelectedInvestorId(investor.id)}>
                            Voir les détails
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => navigate(`/admin/contracts?userId=${investor.id}`)}>
                            Voir les contrats
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="text-center h-24">Aucun investisseur trouvé pour ce filtre.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {/* Pagination Controls */}
        <div className="flex items-center justify-end space-x-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Précédent
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} sur {pageCount}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(pageCount, p + 1))}
            disabled={page >= pageCount}
          >
            Suivant
          </Button>
        </div>
      </div>
      <UserDetailDialog 
        userId={selectedInvestorId}
        open={!!selectedInvestorId}
        onOpenChange={(isOpen) => !isOpen && setSelectedInvestorId(null)}
      />
    </>
  );
};