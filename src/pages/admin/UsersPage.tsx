
import { UserList } from "@/components/admin/UserList";

const UsersPage = () => {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Gestion des Utilisateurs</h1>
        <p className="text-muted-foreground">
          Affichez et gérez les comptes des utilisateurs de la plateforme.
        </p>
      </div>
      <UserList />
    </div>
  );
};

export default UsersPage;
