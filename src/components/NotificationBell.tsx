
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getNotifications, markAllNotificationsAsRead, markNotificationAsRead } from "@/services/notificationService";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/contexts/NotificationContext";

export const NotificationBell = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { notifications, unreadCount } = useNotifications(); // Use context

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markOneReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleNotificationClick = (notification: any) => {
    console.log("Notification clicked, link_to:", notification.link_to);
    // Mark as read first
    if (!notification.is_read) {
      markOneReadMutation.mutate(notification.id);
    }
    // Then navigate
    if (notification.link_to) {
      let targetPath = notification.link_to;
      // Check if it's an absolute URL and convert to relative path if necessary
      try {
        const url = new URL(notification.link_to);
        // If the host matches the current host, it's an internal absolute URL
        // We only want the pathname for react-router-dom
        if (url.origin === window.location.origin) {
          targetPath = url.pathname;
        }
      } catch (e) {
        // Not a valid URL, assume it's already a relative path
      }
      navigate(targetPath);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="font-medium leading-none">Notifications</h4>
              {unreadCount > 0 && (
                <Button variant="link" size="sm" onClick={() => markAllReadMutation.mutate()}>
                  <CheckCheck className="mr-2 h-4 w-4" /> Marquer comme lu
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Vous avez {unreadCount} notification(s) non lue(s).
            </p>
          </div>
          <div className="grid gap-2 max-h-96 overflow-y-auto">
            {notifications && notifications.length > 0 ? (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`grid grid-cols-[25px_1fr] items-start pb-4 last:mb-0 last:pb-0 cursor-pointer hover:bg-muted/50 p-2 rounded-md ${
                    !notification.is_read ? "font-semibold" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <span className={`flex h-2 w-2 translate-y-1 rounded-full ${!notification.is_read ? 'bg-primary' : 'bg-transparent'}`} />
                  <div className="grid gap-1">
                    <p className="text-sm">{notification.message}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center p-4">Aucune notification.</p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
