
import { NotificationBell } from "./NotificationBell";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { UserNav } from "./UserNav";

export const AppHeader = () => {
  const isMobile = useIsMobile();

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between whitespace-nowrap border-b border-solid border-border bg-background/80 px-4 sm:px-8 py-3 backdrop-blur-sm">
      <div>
        {isMobile && <SidebarTrigger />}
      </div>
      <div className="flex items-center gap-4">
        <NotificationBell />
        <UserNav />
      </div>
    </header>
  );
};
