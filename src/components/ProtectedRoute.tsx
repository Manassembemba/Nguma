import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, LogOut, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { getProfile } from "@/services/profileService";
import {
  isUserBanned,
  formatBanMessage,
  saveNavigationState,
  isPublicRoute
} from "@/services/navigationService";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [sessionLoading, setSessionLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  // 1. Gérer l'état de la session Supabase
  useEffect(() => {
    let mounted = true;

    // Récupérer la session initiale
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setSession(session);
        setSessionLoading(false);
      }
    });

    // Écouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (mounted) {
        setSession(currentSession);
        setSessionLoading(false);
        
        // Invalider le profil si la session change (ex: reconnexion)
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          queryClient.invalidateQueries({ queryKey: ['profile'] });
        }
        
        // Si déconnecté, vider le cache
        if (event === 'SIGNED_OUT') {
          queryClient.clear();
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // 2. Récupérer le profil via React Query (Cache partagé)
  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    enabled: !!session?.user, // Ne lancer que si on a une session
    staleTime: 1000 * 60 * 5, // Garder en cache 5 minutes
    retry: 1,
  });

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      queryClient.clear();
    } finally {
      window.location.href = "/auth";
    }
  };

  // Chargement
  if (sessionLoading || (session && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground animate-pulse">Vérification de la session...</p>
        </div>
      </div>
    );
  }

  // Non authentifié
  if (!session?.user) {
    const currentPath = location.pathname + location.search;
    if (!isPublicRoute(currentPath)) {
      saveNavigationState(currentPath);
    }
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  // Erreur de récupération du profil
  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card rounded-2xl shadow-2xl border-2 border-destructive/50 p-8 text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-12 h-12 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-destructive">Erreur de profil</h1>
            <p className="text-muted-foreground">Impossible de charger vos informations utilisateur.</p>
          </div>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Retour à la connexion
          </Button>
        </div>
      </div>
    );
  }

  // Utilisateur banni
  if (profile?.banned_until && new Date(profile.banned_until) > new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-destructive/5 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border-2 border-destructive p-8 text-center space-y-6 animate-in fade-in zoom-in duration-300">
          <div className="mx-auto w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-12 h-12 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold text-destructive tracking-tight uppercase">Accès Refusé</h1>
            <p className="text-xl font-bold text-gray-900">Compte suspendu</p>
          </div>
          <p className="text-gray-600 leading-relaxed">
            {formatBanMessage(profile as any)}
          </p>
          <Button variant="outline" className="w-full border-2" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
