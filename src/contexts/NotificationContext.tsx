import { createContext, useContext, ReactNode, useEffect, useRef, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNotifications, type Notification } from '@/services/notificationService';

// Custom hook to get the previous value of a prop or state.
const usePrevious = <T,>(value: T) => {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

interface NotificationStats {
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  stats: NotificationStats;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [userInteracted, setUserInteracted] = useState(false);

  // Détecter la première interaction utilisateur
  useEffect(() => {
    const handleInteraction = () => {
      setUserInteracted(true);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };

    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 15000, // Réduit à 15s pour moins de charge réseau
  });

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;
  const prevUnreadCount = usePrevious(unreadCount);

  // Calculate statistics
  const stats = useMemo<NotificationStats>(() => {
    if (!notifications) {
      return { byType: {}, byPriority: {} };
    }

    const byType: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    notifications.forEach(notification => {
      const type = notification.type || 'system';
      byType[type] = (byType[type] || 0) + 1;
      const priority = notification.priority || 'medium';
      byPriority[priority] = (byPriority[priority] || 0) + 1;
    });

    return { byType, byPriority };
  }, [notifications]);

  useEffect(() => {
    // Jouer le son seulement si le nombre augmente ET que l'utilisateur a interagi
    if (userInteracted && prevUnreadCount !== undefined && unreadCount > prevUnreadCount) {
      playNotificationSound();
    }
  }, [unreadCount, prevUnreadCount, userInteracted]);

  // Fonction pour jouer le son de notification
  const playNotificationSound = () => {
    const audio = new Audio('/notification.mp3');
    audio.play().catch(() => {
      // Fallback silencieux si l'audio échoue (déjà loggué dans la console)
    });
  };

  const value = {
    notifications: notifications || [],
    unreadCount,
    isLoading,
    stats,
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
