-- This file fixes a bug in reject_withdrawal that occurs when rejecting "legacy" withdrawals
-- created before the locked_balance logic was introduced.

CREATE OR REPLACE FUNCTION public.reject_withdrawal(transaction_id_to_reject UUID, reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target_transaction RECORD;
  user_wallet RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Not an admin');
  END IF;

  -- Find the pending transaction
  SELECT * INTO target_transaction
  FROM public.transactions
  WHERE id = transaction_id_to_reject AND status = 'pending' AND type = 'withdrawal';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pending withdrawal not found');
  END IF;

  -- Get the user's wallet
  SELECT * INTO user_wallet
  FROM public.wallets
  WHERE user_id = target_transaction.user_id;

  -- Check if there are enough funds in locked_balance to perform the reversal.
  -- This handles legacy transactions where funds were never locked.
  IF user_wallet.locked_balance >= target_transaction.amount THEN
    -- Standard case: Return the locked funds to the profit balance
    UPDATE public.wallets
    SET
      profit_balance = profit_balance + target_transaction.amount,
      locked_balance = locked_balance - target_transaction.amount
    WHERE user_id = target_transaction.user_id;
  END IF;
  -- If locked_balance is insufficient, we assume it's a legacy transaction
  -- and no balance update is needed, as the funds were never locked.

  -- Update the transaction status to cancelled
  UPDATE public.transactions
  SET status = 'cancelled', description = 'Withdrawal rejected by admin. Reason: ' || reason
  WHERE id = transaction_id_to_reject;

  -- Update notifications
  UPDATE public.notifications SET is_read = true WHERE reference_id = transaction_id_to_reject;
  INSERT INTO public.notifications (user_id, message, link_to)
  SELECT user_id, 'Votre retrait a été rejeté. Raison: ' || reason, '/wallet'
  FROM public.transactions
  WHERE id = transaction_id_to_reject;

  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal rejected');
END;
$$;
