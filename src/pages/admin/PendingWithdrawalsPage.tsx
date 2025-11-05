
import { PendingWithdrawals } from "@/components/admin/PendingWithdrawals";

const PendingWithdrawalsPage = () => {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Retraits en Attente</h1>
        <p className="text-muted-foreground">
          Gérez les demandes de retrait des utilisateurs.
        </p>
      </div>
      <PendingWithdrawals />
    </div>
  );
};

export default PendingWithdrawalsPage;
