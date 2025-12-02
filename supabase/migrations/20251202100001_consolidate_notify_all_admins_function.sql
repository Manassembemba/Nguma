-- Migration: Consolidate the notify_all_admins function to resolve "not unique" error.
-- Cause: Multiple overloaded versions of the function exist due to progressive changes.
-- Solution: Drop all known legacy versions and create a single, definitive version.

-- Step 1: Drop all potentially conflicting old versions of the function.
-- The signatures must match the old definitions exactly.
DROP FUNCTION IF EXISTS public.notify_all_admins(text, text);
DROP FUNCTION IF EXISTS public.notify_all_admins(text, text, uuid);
DROP FUNCTION IF EXISTS public.notify_all_admins(text, text, text, text);

-- Step 2: Create the single, canonical version of the function.
-- This is the most recent version, incorporating type, priority, and reference_id.
CREATE OR REPLACE FUNCTION public.notify_all_admins(
  message_text TEXT, 
  link TEXT DEFAULT NULL,
  notification_type TEXT DEFAULT 'admin',
  notification_priority TEXT DEFAULT 'medium',
  ref_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_record RECORD;
BEGIN
  FOR admin_record IN 
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, message, link_to, type, priority, reference_id)
    VALUES (admin_record.user_id, message_text, link, notification_type, notification_priority, ref_id);
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.notify_all_admins(TEXT, TEXT, TEXT, TEXT, UUID) IS 'Consolidated function to send notifications to all administrators, resolving previous signature conflicts.';
