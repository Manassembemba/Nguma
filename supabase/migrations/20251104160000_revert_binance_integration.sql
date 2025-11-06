-- This migration reverts parts of the Binance integration by dropping the RPC function used by the webhook.
DROP FUNCTION IF EXISTS public.admin_create_pending_deposit(user_id_to_credit UUID, deposit_amount NUMERIC, deposit_method TEXT);
