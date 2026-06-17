
import { Link } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { UserNav } from "./UserNav";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export const AppHeader = () => {
  const isMobile = useIsMobile();
  
  const { data: pendingKycs } = useQuery({
    queryKey: ["pendingKycsCount"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: 'exact', head: true })
        .eq("kyc_status", "pending");
      if (error) throw error;
      return count || 0;
    },
  });

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between whitespace-nowrap border-b border-solid border-border bg-background/80 px-4 sm:px-8 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        {isMobile && <SidebarTrigger />}
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="Nguma"
            className="h-10 w-auto rounded-md shadow-sm"
          />
          <span className="hidden sm:inline-block text-lg font-semibold tracking-wide">
            Nguma
          </span>
        </Link>
      </div>
      <div className="flex items-center gap-4">
        {(pendingKycs || 0) > 0 && (
          <Link to="/admin/kyc" className="relative">
            <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] animate-bounce">
              {pendingKycs}
            </Badge>
            <Button variant="outline" size="icon" className="h-10 w-10">
              <Shield className="h-5 w-5" />
            </Button>
          </Link>
        )}
        <NotificationBell />
        <UserNav />
      </div>
    </header>
  );
};
