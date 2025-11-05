
-- Add reference_id to notifications table to link a notification to a specific item (e.g., a transaction)
ALTER TABLE public.notifications
ADD COLUMN reference_id UUID;

-- Add an index for faster lookups
CREATE INDEX idx_notifications_reference_id ON public.notifications(reference_id);
