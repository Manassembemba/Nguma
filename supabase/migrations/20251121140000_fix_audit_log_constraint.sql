-- Fix the check constraint on audit_logs to correctly allow dots in action names
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS valid_action_format;

ALTER TABLE public.audit_logs 
ADD CONSTRAINT valid_action_format 
CHECK (action ~ '^[a-z_]+\.[a-z_]+$');
