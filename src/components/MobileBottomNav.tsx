
import { NavLink } from "react-router-dom";
import { LayoutDashboard, FileText, TrendingUp, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Contrats", url: "/contracts", icon: FileText },
  { title: "Transactions", url: "/transactions", icon: TrendingUp },
  { title: "Support", url: "/support", icon: MessageCircle },
  { title: "Profil", url: "/profile", icon: User },
];

export const MobileBottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 block md:hidden bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg border-t border-zinc-200 dark:border-zinc-800 pb-safe">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-300",
                isActive 
                  ? "text-primary scale-110" 
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-bold uppercase tracking-tighter leading-none">
              {item.title}
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
