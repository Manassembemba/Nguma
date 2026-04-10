
import { Plus, ArrowUpCircle, ArrowDownCircle, RefreshCw, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DepositDialog } from "./DepositDialog";
import { NewContractDialog } from "./NewContractDialog";
import { WithdrawDialog } from "./WithdrawDialog";
import { ReinvestDialog } from "./ReinvestDialog";
import { TransferProfitToDepositDialog } from "./TransferProfitToDepositDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";

interface DashboardActionsProps {
  wallet: any;
}

export const DashboardActions = ({ wallet }: DashboardActionsProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="flex gap-2 w-full">
        <div className="flex-1">
          <DepositDialog />
        </div>
        <div className="flex-1">
          <NewContractDialog />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="px-3">
              <Plus className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Actions Financières</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <div className="w-full">
                <WithdrawDialog wallet={wallet} />
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <div className="w-full">
                <ReinvestDialog wallet={wallet} />
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <div className="w-full">
                <TransferProfitToDepositDialog wallet={wallet} />
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <DepositDialog />
      <NewContractDialog />
      <div className="h-8 w-[1px] bg-border mx-2" />
      <WithdrawDialog wallet={wallet} />
      <ReinvestDialog wallet={wallet} />
      <TransferProfitToDepositDialog wallet={wallet} />
    </div>
  );
};
