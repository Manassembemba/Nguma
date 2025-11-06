import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getInvestorsList } from "@/services/adminService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";

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
  const hasActiveContract = contracts.some(c => c.status === 'active');
  
  if (hasActiveContract) {
    return <Badge className="bg-primary/20 text-primary">Active</Badge>;
  }
  if (contracts.length > 0) {
    return <Badge variant="secondary">Inactive</Badge>;
  }
  return <Badge variant="outline">New</Badge>;
};

const PAGE_SIZE = 10;

export const InvestorListTable = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const { data, isLoading } = useQuery<{ data: Investor[], count: number }>({ 
    queryKey: ["investorsList", debouncedSearchQuery, page],
    queryFn: () => getInvestorsList(debouncedSearchQuery, page, PAGE_SIZE),
  });

  const investors = data?.data || [];
  const totalCount = data?.count || 0;
  const pageCount = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="lg:col-span-2 flex flex-col rounded-lg bg-background-card border border-white/10 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Investors</h3>
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
      </div>
      <div className="overflow-x-auto flex-grow">
        <Table className="w-full text-left text-sm">
          <TableHeader className="border-b border-white/10 text-text-secondary uppercase">
            <TableRow>
              <TableHead className="p-3">Name</TableHead>
              <TableHead className="p-3">Balance</TableHead>
              <TableHead className="p-3">PNL %</TableHead>
              <TableHead className="p-3">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center">Chargement...</TableCell></TableRow>
            ) : investors.length > 0 ? (
              investors.map((investor) => (
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
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={4} className="text-center h-24">Aucun investisseur trouvé.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {/* Pagination Controls */}
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"n          size="sm"
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
  );
};