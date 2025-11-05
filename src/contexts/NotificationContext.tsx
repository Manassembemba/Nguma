
import { createContext, useContext, ReactNode, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNotifications } from '@/services/notificationService';
import type { Database } from '@/integrations/supabase/types';

// Custom hook to get the previous value of a prop or state.
const usePrevious = <T,>(value: T) => {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

type Notification = Database['public']['Tables']['notifications']['Row'];

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { data: notifications, isLoading } = useQuery<Notification[]>({ 
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 60000, // Keep the 60-second refresh
  });

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;
  const prevUnreadCount = usePrevious(unreadCount);

  useEffect(() => {
    // Play sound only when the unread count increases
    if (prevUnreadCount !== undefined && unreadCount > prevUnreadCount) {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(error => {
        // Autoplay was prevented by the browser.
        console.warn("Notification sound was blocked by the browser. User interaction is required to enable sound.", error);
      });
    }
  }, [unreadCount, prevUnreadCount]);

  const value = {
    notifications: notifications || [],
    unreadCount,
    isLoading,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
