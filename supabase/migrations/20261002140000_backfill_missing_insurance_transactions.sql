-- Migration: Backfill missing insurance transactions from insured contracts
-- Date: 2026-10-02
-- Description: Ensures all insured contracts with insurance_fee_paid > 0 have a corresponding transaction in public.transactions

INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    currency,
    status,
    reference_id,
    description,
    created_at,
    updated_at
)
SELECT 
    c.user_id,
    'insurance',
    c.insurance_fee_paid,
    COALESCE(c.currency, 'USD'),
    'completed',
    c.id,
    'Frais d''assurance du contrat',
    c.created_at,
    c.created_at
FROM public.contracts c
WHERE c.insurance_fee_paid > 0
  AND NOT EXISTS (
      SELECT 1 FROM public.transactions t 
      WHERE t.reference_id = c.id 
        AND LOWER(t.type) IN ('assurance', 'insurance')
  );
