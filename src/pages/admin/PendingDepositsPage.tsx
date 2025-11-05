
import { PendingDeposits } from "@/components/admin/PendingDeposits";

const PendingDepositsPage = () => {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dépôts en Attente</h1>
        <p className="text-muted-foreground">
          Gérez les demandes de dépôt des utilisateurs.
        </p>
      </div>
      <PendingDeposits />
    </div>
  );
};

export default PendingDepositsPage;
