
-- This file fixes the execute_refund function to prevent negative balances.

CREATE OR REPLACE FUNCTION public.execute_refund(_contract_id UUID, _user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  contract_record RECORD;
  wallet_record RECORD;
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

  -- Get wallet and check balance before proceeding
  SELECT * INTO wallet_record FROM public.wallets WHERE user_id = _user_id;
  IF wallet_record.invested_balance < contract_record.amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Inconsistent data: Invested balance is less than the contract amount being refunded.');
  END IF;
  
  refund_amount := contract_record.amount - contract_record.total_profit_paid;
  
  IF refund_amount < 0 THEN
    refund_amount := 0;
  END IF;
  
  UPDATE public.wallets
  SET 
    total_balance = total_balance + refund_amount,
    invested_balance = invested_balance - contract_record.amount
  WHERE user_id = _user_id;
  
  INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
  VALUES (_user_id, 'refund', refund_amount, contract_record.currency, _contract_id, 'Early refund from contract');
  
  UPDATE public.contracts SET status = 'refunded' WHERE id = _contract_id;
  
  result := jsonb_build_object('success', true, 'refund_amount', refund_amount, 'contract_id', _contract_id);
  
  RETURN result;
END;
$$;
