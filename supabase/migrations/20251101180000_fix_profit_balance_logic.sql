
-- This file fixes the profit calculation logic to ensure total_balance is correctly updated.

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
    
    -- Correctly update both profit_balance and total_balance
    UPDATE public.wallets
    SET 
      profit_balance = profit_balance + profit_amount,
      total_balance = total_balance + profit_amount -- This line is restored
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
