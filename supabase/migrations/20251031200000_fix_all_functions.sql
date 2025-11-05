
-- This file contains the final, corrected versions of all modified RPC functions.

-- 1. Corrected calculate_monthly_profits (adds currency to transaction and sends notification)
CREATE OR REPLACE FUNCTION public.calculate_monthly_profits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  contract_record RECORD;
  profit_amount NUMERIC(20,8);
  current_month INTEGER;
BEGIN
  FOR contract_record IN 
    SELECT * FROM public.contracts 
    WHERE status = 'active' 
    AND months_paid < duration_months
  LOOP
    current_month := contract_record.months_paid + 1;
    profit_amount := contract_record.amount * contract_record.monthly_rate;
    
    INSERT INTO public.profits (contract_id, user_id, amount, month_number)
    VALUES (contract_record.id, contract_record.user_id, profit_amount, current_month);
    
    UPDATE public.wallets
    SET profit_balance = profit_balance + profit_amount, updated_at = now()
    WHERE user_id = contract_record.user_id;
    
    INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
    VALUES (contract_record.user_id, 'profit', profit_amount, contract_record.currency, contract_record.id, 'Monthly profit from contract month ' || current_month::TEXT);
    
    UPDATE public.contracts
    SET 
      months_paid = current_month,
      total_profit_paid = total_profit_paid + profit_amount,
      status = CASE WHEN current_month >= duration_months THEN 'completed' ELSE 'active' END
    WHERE id = contract_record.id;

    INSERT INTO public.notifications (user_id, message, link_to)
    VALUES (contract_record.user_id, 'Votre profit mensuel de ' || profit_amount || ' ' || contract_record.currency || ' a été versé.', '/wallet');
  END LOOP;
END;
$$;

-- 2. Corrected execute_refund (adds 5-month check and currency to transaction)
CREATE OR REPLACE FUNCTION public.execute_refund(_contract_id UUID, _user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  contract_record RECORD;
  refund_amount NUMERIC(20,8);
  result JSONB;
BEGIN
  SELECT * INTO contract_record
  FROM public.contracts
  WHERE id = _contract_id AND user_id = _user_id AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found or not active');
  END IF;

  IF contract_record.months_paid >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Early refund is only possible within the first 5 months.');
  END IF;
  
  refund_amount := contract_record.amount - contract_record.total_profit_paid;
  
  IF refund_amount < 0 THEN
    refund_amount := 0;
  END IF;
  
  UPDATE public.wallets
  SET 
    total_balance = total_balance + refund_amount,
    invested_balance = invested_balance - contract_record.amount,
    updated_at = now()
  WHERE user_id = _user_id;
  
  INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
  VALUES (_user_id, 'refund', refund_amount, contract_record.currency, _contract_id, 'Early refund from contract');
  
  UPDATE public.contracts
  SET status = 'refunded'
  WHERE id = _contract_id;
  
  result := jsonb_build_object('success', true, 'refund_amount', refund_amount, 'contract_id', _contract_id);
  
  RETURN result;
END;
$$;

-- 3. Corrected approve_deposit (removes manual updated_at)
CREATE OR REPLACE FUNCTION public.approve_deposit(transaction_id_to_approve UUID)
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
  WHERE id = transaction_id_to_approve AND status = 'pending' AND type = 'deposit';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pending transaction not found');
  END IF;

  UPDATE public.transactions
  SET status = 'completed'
  WHERE id = transaction_id_to_approve;

  UPDATE public.wallets
  SET total_balance = total_balance + target_transaction.amount
  WHERE user_id = target_transaction.user_id;

  INSERT INTO public.notifications (user_id, message, link_to)
  VALUES (target_transaction.user_id, 'Votre dépôt de ' || target_transaction.amount || ' ' || target_transaction.currency || ' a été approuvé.', '/wallet');

  RETURN jsonb_build_object('success', true, 'message', 'Deposit approved successfully');
END;
$$;

-- 4. Corrected approve_withdrawal (removes manual updated_at)
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

  UPDATE public.wallets
  SET
    total_balance = total_balance - target_transaction.amount,
    profit_balance = profit_balance - target_transaction.amount
  WHERE user_id = target_transaction.user_id AND profit_balance >= target_transaction.amount;

  IF NOT FOUND THEN
    UPDATE public.transactions SET status = 'failed', description = 'Insufficient funds at time of approval' WHERE id = transaction_id_to_approve;
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds at time of approval. Transaction marked as failed.');
  END IF;

  UPDATE public.transactions
  SET status = 'completed'
  WHERE id = transaction_id_to_approve;

  INSERT INTO public.notifications (user_id, message, link_to)
  VALUES (target_transaction.user_id, 'Votre retrait de ' || target_transaction.amount || ' ' || target_transaction.currency || ' a été approuvé.', '/wallet');

  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal approved successfully');
END;
$$;
