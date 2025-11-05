
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches the current user's notifications.
 */
export const getNotifications = async () => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw new Error("Could not fetch notifications.");
  return data || [];
};

/**
 * Marks a specific notification as read.
 */
export const markNotificationAsRead = async (notificationId: string) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) throw new Error("Could not mark notification as read.");
};

/**
 * Marks all of the user's notifications as read.
 */
export const markAllNotificationsAsRead = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) throw new Error("Could not mark all notifications as read.");
};
