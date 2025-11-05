
-- This file updates the withdrawal logic to use the new locked_balance column.

-- 1. Update user_withdraw to move funds from profit_balance to locked_balance
CREATE OR REPLACE FUNCTION public.user_withdraw(withdraw_amount NUMERIC(20,8))
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  user_wallet RECORD;
  new_transaction_id UUID;
BEGIN
  IF withdraw_amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Withdrawal amount must be positive'); END IF;

  SELECT * INTO user_wallet FROM public.wallets WHERE user_id = current_user_id;
  IF user_wallet.profit_balance < withdraw_amount THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient profit balance'); END IF;

  -- Lock the funds
  UPDATE public.wallets
  SET 
    profit_balance = profit_balance - withdraw_amount,
    locked_balance = locked_balance + withdraw_amount
  WHERE user_id = current_user_id;

  INSERT INTO public.transactions (user_id, type, amount, currency, status, description)
  VALUES (current_user_id, 'withdrawal', withdraw_amount, user_wallet.currency, 'pending', 'User withdrawal request')
  RETURNING id INTO new_transaction_id;

  PERFORM public.notify_all_admins('Nouvelle demande de retrait de ' || withdraw_amount || ' ' || user_wallet.currency, '/admin/withdrawals', new_transaction_id);
  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal request created and is pending approval.');
END;
$$;

-- 2. Update approve_withdrawal to clear funds from locked_balance
CREATE OR REPLACE FUNCTION public.approve_withdrawal(transaction_id_to_approve UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target_transaction RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Not an admin'); END IF;
  
  SELECT * INTO target_transaction FROM public.transactions WHERE id = transaction_id_to_approve AND status = 'pending' AND type = 'withdrawal';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Pending withdrawal not found'); END IF;

  -- Decrement locked_balance. We assume the funds were already checked when locked.
  UPDATE public.wallets
  SET locked_balance = locked_balance - target_transaction.amount
  WHERE user_id = target_transaction.user_id;

  IF NOT FOUND THEN
    UPDATE public.transactions SET status = 'failed', description = 'Wallet not found during approval' WHERE id = transaction_id_to_approve;
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found. Transaction marked as failed.');
  END IF;

  UPDATE public.transactions SET status = 'completed' WHERE id = transaction_id_to_approve;
  UPDATE public.notifications SET is_read = true WHERE reference_id = transaction_id_to_approve;
  INSERT INTO public.notifications (user_id, message, link_to) VALUES (target_transaction.user_id, 'Votre retrait de ' || target_transaction.amount || ' ' || target_transaction.currency || ' a été approuvé.', '/wallet');
  
  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal approved successfully');
END;
$$;

-- 3. Update reject_withdrawal to return funds from locked_balance to profit_balance
CREATE OR REPLACE FUNCTION public.reject_withdrawal(transaction_id_to_reject UUID, reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target_transaction RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Not an admin'); END IF;

  SELECT * INTO target_transaction FROM public.transactions WHERE id = transaction_id_to_reject AND status = 'pending' AND type = 'withdrawal';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Pending withdrawal not found'); END IF;

  -- Return the locked funds to the profit balance
  UPDATE public.wallets
  SET
    profit_balance = profit_balance + target_transaction.amount,
    locked_balance = locked_balance - target_transaction.amount
  WHERE user_id = target_transaction.user_id;

  UPDATE public.transactions SET status = 'cancelled', description = 'Withdrawal rejected by admin. Reason: ' || reason WHERE id = transaction_id_to_reject;
  
  UPDATE public.notifications SET is_read = true WHERE reference_id = transaction_id_to_reject;
  INSERT INTO public.notifications (user_id, message, link_to) SELECT user_id, 'Votre retrait a été rejeté. Raison: ' || reason, '/wallet' FROM public.transactions WHERE id = transaction_id_to_reject;
  
  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal rejected');
END;
$$;
