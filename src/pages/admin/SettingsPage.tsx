
import { AdminSettings } from "@/components/admin/AdminSettings";

const SettingsPage = () => {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Gestion des Paramètres</h1>
        <p className="text-muted-foreground">
          Modifiez les paramètres globaux de la plateforme.
        </p>
      </div>
      <AdminSettings />
    </div>
  );
};

export default SettingsPage;
