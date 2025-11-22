-- Add withdrawal settings for limits and fees
INSERT INTO public.settings (key, value, description, type)
VALUES 
  ('min_withdrawal_amount', '10', 'Montant minimum de retrait (USD)', 'number'),
  ('max_withdrawal_amount', '10000', 'Montant maximum de retrait (USD)', 'number'),
  ('withdrawal_fee_percent', '2', 'Frais de retrait en pourcentage (%)', 'number'),
  ('withdrawal_fee_fixed', '1', 'Frais de retrait fixe (USD)', 'number')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  updated_at = now();
