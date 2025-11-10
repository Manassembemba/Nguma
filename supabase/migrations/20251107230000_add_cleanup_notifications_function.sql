-- Function to clean up old, read notifications.

CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.notifications
    WHERE is_read = TRUE
      AND created_at < NOW() - INTERVAL '30 days'; -- Delete notifications older than 30 days and marked as read
END;
$$;
