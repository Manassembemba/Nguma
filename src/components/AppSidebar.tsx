import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Wallet, FileText, TrendingUp, Settings, Users, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { getWallet } from "@/services/walletService";
import { formatCurrency } from "@/lib/utils";
import { useNotifications } from "@/contexts/NotificationContext";

const investorItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Mes Contrats", url: "/contracts", icon: FileText },
  { title: "Wallet", url: "/wallet", icon: Wallet },
  { title: "Transactions", url: "/transactions", icon: TrendingUp },
];

const adminItems = [
  { title: "Admin Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Dépôts en attente", url: "/admin/deposits", icon: FileText },
  { title: "Retraits en attente", url: "/admin/withdrawals", icon: FileText },
  { title: "Utilisateurs", url: "/admin/users", icon: Users },
  { title: "Paramètres", url: "/admin/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { toast } = useToast();
  const { notifications } = useNotifications();

  const { data: userRole } = useQuery({
    queryKey: ["userRole"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
      return data?.role;
    },
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: getWallet,
    enabled: !!userRole,
  });

  const isAdmin = userRole === "admin";

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: "Déconnexion réussie" });
    navigate("/auth");
  };

  const hasUnreadForLink = (url: string) => {
    return notifications.some(n => !n.is_read && n.link_to === url);
  };

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"}>
      <div className="p-4 border-b border-border flex flex-col items-start">
        {/* Header */}
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Investisseur</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {investorItems.map((item) => (
                <SidebarMenuItem key={item.title} className="relative">
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                  {hasUnreadForLink(item.url) && !collapsed && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title} className="relative">
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end className={getNavCls}>
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                    {hasUnreadForLink(item.url) && !collapsed && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup className="mt-auto">
          {/* Logout */}
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}