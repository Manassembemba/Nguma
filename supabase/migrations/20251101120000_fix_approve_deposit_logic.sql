
-- This file fixes the approve_deposit function to be more robust.

CREATE OR REPLACE FUNCTION public.approve_deposit(transaction_id_to_approve UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_transaction RECORD;
  updated_wallet RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Not an admin');
  END IF;

  SELECT * INTO target_transaction
  FROM public.transactions
  WHERE id = transaction_id_to_approve AND status = 'pending' AND type = 'deposit';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pending transaction not found');
  END IF;

  -- First, update the wallet and check if it was successful
  UPDATE public.wallets
  SET total_balance = total_balance + target_transaction.amount
  WHERE user_id = target_transaction.user_id
  RETURNING * INTO updated_wallet;

  IF updated_wallet IS NULL THEN
    -- This can happen if the user has no wallet. Mark transaction as failed.
    UPDATE public.transactions SET status = 'failed', description = 'User wallet not found during approval' WHERE id = transaction_id_to_approve;
    RETURN jsonb_build_object('success', false, 'error', 'User wallet not found. Transaction marked as failed.');
  END IF;

  -- If wallet update was successful, then update the transaction status
  UPDATE public.transactions SET status = 'completed' WHERE id = transaction_id_to_approve;

  -- Mark admin notifications for this transaction as read
  UPDATE public.notifications SET is_read = true WHERE reference_id = transaction_id_to_approve;

  -- Notify user of the approval
  INSERT INTO public.notifications (user_id, message, link_to)
  VALUES (target_transaction.user_id, 'Votre dépôt de ' || target_transaction.amount || ' ' || target_transaction.currency || ' a été approuvé.', '/wallet');

  RETURN jsonb_build_object('success', true, 'message', 'Deposit approved successfully');
END;
$$;
