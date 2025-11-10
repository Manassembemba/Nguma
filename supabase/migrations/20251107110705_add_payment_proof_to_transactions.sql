-- Add columns for payment proof to the transactions table

ALTER TABLE public.transactions
ADD COLUMN payment_reference TEXT NULL,
ADD COLUMN payment_phone_number TEXT NULL;

COMMENT ON COLUMN public.transactions.payment_reference IS 'Stores the transaction ID (e.g., TxID from a blockchain) for payment verification.';
COMMENT ON COLUMN public.transactions.payment_phone_number IS 'Stores the phone number used for a mobile money payment.';
