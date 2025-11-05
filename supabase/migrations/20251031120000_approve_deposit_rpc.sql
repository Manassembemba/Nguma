
-- Function for an admin to approve a pending deposit
CREATE OR REPLACE FUNCTION public.approve_deposit(transaction_id_to_approve UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_transaction RECORD;
BEGIN
  -- Check if the current user is an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Not an admin');
  END IF;

  -- Find the pending transaction
  SELECT * INTO target_transaction
  FROM public.transactions
  WHERE id = transaction_id_to_approve AND status = 'pending' AND type = 'deposit';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pending transaction not found');
  END IF;

  -- Update the transaction status
  UPDATE public.transactions
  SET status = 'completed'
  WHERE id = transaction_id_to_approve;

  -- Update the user's wallet
  UPDATE public.wallets
  SET
    total_balance = total_balance + target_transaction.amount,
    updated_at = now()
  WHERE user_id = target_transaction.user_id;

  -- Notify user
  INSERT INTO public.notifications (user_id, message, link_to)
  VALUES (target_transaction.user_id, 'Votre dépôt de ' || target_transaction.amount || ' ' || target_transaction.currency || ' a été approuvé.', '/wallet');

  RETURN jsonb_build_object('success', true, 'message', 'Deposit approved successfully');
END;
$$;
