
-- 1. Modify the user_withdraw function to create a PENDING request
-- It no longer touches the wallet balance.
CREATE OR REPLACE FUNCTION public.user_withdraw(withdraw_amount NUMERIC(20,8))
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  user_wallet RECORD;
BEGIN
  IF withdraw_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal amount must be positive');
  END IF;

  -- Get user wallet and check profit balance
  SELECT * INTO user_wallet
  FROM public.wallets
  WHERE user_id = current_user_id;

  IF user_wallet.profit_balance < withdraw_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient profit balance');
  END IF;

  -- Create a PENDING withdrawal transaction
  INSERT INTO public.transactions (user_id, type, amount, currency, status, description)
  VALUES (
    current_user_id,
    'withdrawal',
    withdraw_amount,
    user_wallet.currency,
    'pending', -- Set status to pending
    'User withdrawal request'
  );

  -- Notify admins
  PERFORM public.notify_all_admins('Nouvelle demande de retrait de ' || withdraw_amount || ' ' || user_wallet.currency, '/admin/withdrawals');

  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal request created and is pending approval.');
END;
$$;

-- 2. Add a function for admins to APPROVE a withdrawal
CREATE OR REPLACE FUNCTION public.approve_withdrawal(transaction_id_to_approve UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_transaction RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Not an admin');
  END IF;

  SELECT * INTO target_transaction
  FROM public.transactions
  WHERE id = transaction_id_to_approve AND status = 'pending' AND type = 'withdrawal';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pending withdrawal not found');
  END IF;

  -- Check for sufficient funds again at the time of approval
  UPDATE public.wallets
  SET
    total_balance = total_balance - target_transaction.amount,
    profit_balance = profit_balance - target_transaction.amount,
    updated_at = now()
  WHERE user_id = target_transaction.user_id AND profit_balance >= target_transaction.amount;

  IF NOT FOUND THEN
    -- This will happen if the user's profit balance changed and is no longer sufficient
    UPDATE public.transactions SET status = 'failed', description = 'Insufficient funds at time of approval' WHERE id = transaction_id_to_approve;
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds at time of approval. Transaction marked as failed.');
  END IF;

  -- If wallet update was successful, update transaction
  UPDATE public.transactions
  SET status = 'completed'
  WHERE id = transaction_id_to_approve;

  -- Notify user
  INSERT INTO public.notifications (user_id, message, link_to)
  VALUES (target_transaction.user_id, 'Votre retrait de ' || target_transaction.amount || ' ' || target_transaction.currency || ' a été approuvé.', '/wallet');

  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal approved successfully');

  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal approved successfully');
END;
$$;

-- 3. Add a function for admins to REJECT a withdrawal
CREATE OR REPLACE FUNCTION public.reject_withdrawal(transaction_id_to_reject UUID, reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Not an admin');
  END IF;

  UPDATE public.transactions
  SET status = 'cancelled', description = 'Withdrawal rejected by admin. Reason: ' || reason
  WHERE id = transaction_id_to_reject AND status = 'pending' AND type = 'withdrawal';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pending withdrawal not found');
  END IF;

  -- Notify user
  INSERT INTO public.notifications (user_id, message, link_to)
  SELECT user_id, 'Votre retrait a été rejeté. Raison: ' || reason, '/wallet'
  FROM public.transactions
  WHERE id = transaction_id_to_reject;

  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal rejected');
END;
$$;
