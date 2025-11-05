
-- This file fixes the balance logic according to the user's specified rules.

-- 1. Ensure calculate_monthly_profits ONLY increments profit_balance
CREATE OR REPLACE FUNCTION public.calculate_monthly_profits()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  contract_record RECORD;
  profit_amount NUMERIC(20,8);
  current_month INTEGER;
BEGIN
  FOR contract_record IN SELECT * FROM public.contracts WHERE status = 'active' AND months_paid < duration_months LOOP
    current_month := contract_record.months_paid + 1;
    profit_amount := contract_record.amount * contract_record.monthly_rate;
    
    INSERT INTO public.profits (contract_id, user_id, amount, month_number) VALUES (contract_record.id, contract_record.user_id, profit_amount, current_month);
    
    -- Only update profit_balance, not total_balance
    UPDATE public.wallets SET profit_balance = profit_balance + profit_amount WHERE user_id = contract_record.user_id;
    
    INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
    VALUES (contract_record.user_id, 'profit', profit_amount, contract_record.currency, contract_record.id, 'Monthly profit from contract month ' || current_month::TEXT);
    
    UPDATE public.contracts SET months_paid = current_month, total_profit_paid = total_profit_paid + profit_amount, status = CASE WHEN current_month >= duration_months THEN 'completed' ELSE 'active' END WHERE id = contract_record.id;
    
    INSERT INTO public.notifications (user_id, message, link_to) VALUES (contract_record.user_id, 'Votre profit mensuel de ' || profit_amount || ' ' || contract_record.currency || ' a été versé.', '/wallet');
  END LOOP;
END;
$$;

-- 2. Ensure approve_withdrawal ONLY decrements profit_balance
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

  -- Only check and decrement profit_balance
  UPDATE public.wallets
  SET profit_balance = profit_balance - target_transaction.amount
  WHERE user_id = target_transaction.user_id AND profit_balance >= target_transaction.amount;

  IF NOT FOUND THEN
    UPDATE public.transactions SET status = 'failed', description = 'Insufficient profit balance at time of approval' WHERE id = transaction_id_to_approve;
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient profit balance at time of approval. Transaction marked as failed.');
  END IF;

  UPDATE public.transactions SET status = 'completed' WHERE id = transaction_id_to_approve;
  
  UPDATE public.notifications SET is_read = true WHERE reference_id = transaction_id_to_approve;
  
  INSERT INTO public.notifications (user_id, message, link_to) VALUES (target_transaction.user_id, 'Votre retrait de ' || target_transaction.amount || ' ' || target_transaction.currency || ' a été approuvé.', '/wallet');
  
  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal approved successfully');
END;
$$;
