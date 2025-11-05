
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  link_to TEXT, -- Optional link to navigate to on click
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications (e.g., mark as read)"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Create helper function to send notification to all admins
CREATE OR REPLACE FUNCTION public.notify_all_admins(message_text TEXT, link TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  admin_record RECORD;
BEGIN
  FOR admin_record IN 
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, message, link_to)
    VALUES (admin_record.user_id, message_text, link);
  END LOOP;
END;
$$;
