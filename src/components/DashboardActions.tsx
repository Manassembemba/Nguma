
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

import { useState } from "react";

interface DashboardActionsProps {
  wallet: any;
}

export const DashboardActions = ({ wallet }: DashboardActionsProps) => {
  const isMobile = useIsMobile();
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isReinvestOpen, setIsReinvestOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

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
            <DropdownMenuItem onSelect={() => setIsWithdrawOpen(true)}>
              <div className="flex items-center gap-2 w-full cursor-pointer text-destructive">
                <ArrowUpCircle className="h-4 w-4" />
                <span>Retrait</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setIsReinvestOpen(true)}>
              <div className="flex items-center gap-2 w-full cursor-pointer">
                <RefreshCw className="h-4 w-4" />
                <span>Réinvestissement</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setIsTransferOpen(true)}>
              <div className="flex items-center gap-2 w-full cursor-pointer">
                <Repeat className="h-4 w-4" />
                <span>Transfert</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Portaled Dialogs to avoid Radix nesting issues on mobile */}
        <WithdrawDialog 
          wallet={wallet} 
          open={isWithdrawOpen} 
          onOpenChange={setIsWithdrawOpen} 
          showTrigger={false} 
        />
        <ReinvestDialog 
          wallet={wallet} 
          open={isReinvestOpen} 
          onOpenChange={setIsReinvestOpen} 
          showTrigger={false} 
        />
        <TransferProfitToDepositDialog 
          wallet={wallet} 
          open={isTransferOpen} 
          onOpenChange={setIsTransferOpen} 
          showTrigger={false} 
        />
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
