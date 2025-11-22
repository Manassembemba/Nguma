-- Ensure settings table has necessary columns for Admin UI
DO $$
BEGIN
    -- Add 'type' column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'type') THEN
        ALTER TABLE public.settings ADD COLUMN type TEXT DEFAULT 'text';
    END IF;

    -- Add 'options' column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'options') THEN
        ALTER TABLE public.settings ADD COLUMN options JSONB;
    END IF;
END $$;

-- Insert or update the contract_duration_months setting
INSERT INTO public.settings (key, value, description, type)
VALUES (
  'contract_duration_months', 
  '10', 
  'Durée du contrat en mois (ex: 10, 12).', 
  'number'
)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  updated_at = now();
