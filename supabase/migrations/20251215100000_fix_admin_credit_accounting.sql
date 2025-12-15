
-- Migration: Fix Admin Credit Accounting & Reconcile Missing Entries
-- Date: 2025-12-15
-- Description: 
-- 1. Updates `admin_credit_user` to create accounting entries automatically.
-- 2. Retroactively creates missing accounting entries for past 'deposit' transactions that have no corresponding ledger entry.

-- 1. Update the function
CREATE OR REPLACE FUNCTION public.admin_credit_user(target_user_id UUID, credit_amount NUMERIC(20,8), reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user_id UUID := auth.uid();
  user_wallet RECORD;
  new_transaction_id UUID;
  
  -- Accounting accounts
  bank_account_id UUID;
  client_deposits_id UUID;
BEGIN
  -- Check if admin
  IF NOT public.has_role(admin_user_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Not an admin');
  END IF;

  -- Validate
  IF credit_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credit amount must be positive');
  END IF;

  -- Update Wallet
  UPDATE public.wallets
  SET
    total_balance = total_balance + credit_amount,
    updated_at = now()
  WHERE user_id = target_user_id
  RETURNING * INTO user_wallet;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user wallet not found');
  END IF;

  -- Create Transaction
  INSERT INTO public.transactions (user_id, type, amount, currency, status, description, created_at, updated_at)
  VALUES (
    target_user_id,
    'deposit',
    credit_amount,
    user_wallet.currency,
    'completed',
    'Admin credit: ' || reason,
    now(),
    now()
  )
  RETURNING id INTO new_transaction_id;

  -- Log Action
  INSERT INTO public.admin_actions (admin_id, action_type, target_user_id, details)
  VALUES (
    admin_user_id,
    'manual_credit',
    target_user_id,
    jsonb_build_object('amount', credit_amount, 'reason', reason, 'transaction_id', new_transaction_id)
  );

  -- ACCOUNTING ENTRY
  -- Debit: Banque Principale (Asset +) - We assume manual credit implies we received money (e.g. cash) 
  -- Credit: Dépôts Clients (Liability +) - We owe this money to the user
  SELECT id INTO bank_account_id FROM public.company_accounts WHERE name = 'Banque Principale';
  SELECT id INTO client_deposits_id FROM public.company_accounts WHERE name = 'Dépôts Clients';

  IF bank_account_id IS NOT NULL AND client_deposits_id IS NOT NULL THEN
      INSERT INTO public.accounting_entries (
          transaction_date,
          description,
          debit_account_id,
          credit_account_id,
          amount,
          related_transaction_id,
          related_user_id,
          created_by
      ) VALUES (
          now(),
          'Crédit Admin: ' || reason,
          bank_account_id,
          client_deposits_id,
          credit_amount,
          new_transaction_id,
          target_user_id,
          admin_user_id
      );
      
      -- Note: Balances are updated by the trigger on accounting_entries
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'User credited successfully');
END;
$$;


-- 2. Reconciliation Script (DO Block)
DO $$
DECLARE
  rec RECORD;
  bank_account_id UUID;
  client_deposits_id UUID;
  system_user_id UUID;
BEGIN
  -- Get Account IDs
  SELECT id INTO bank_account_id FROM public.company_accounts WHERE name = 'Banque Principale';
  SELECT id INTO client_deposits_id FROM public.company_accounts WHERE name = 'Dépôts Clients';
  
  -- Find all COMPLETED DEPOSIT transactions that have NO entry in accounting_entries
  FOR rec IN 
    SELECT t.* 
    FROM public.transactions t
    LEFT JOIN public.accounting_entries ae ON t.id = ae.related_transaction_id
    WHERE t.type = 'deposit' 
      AND t.status = 'completed'
      AND ae.id IS NULL
  LOOP
    -- Insert missing accounting entry
    INSERT INTO public.accounting_entries (
        transaction_date,
        description,
        debit_account_id,
        credit_account_id,
        amount,
        related_transaction_id,
        related_user_id,
        created_by
    ) VALUES (
        rec.created_at, -- Use original date
        CASE 
            WHEN rec.description IS NOT NULL AND rec.description <> '' THEN 'Régularisation: ' || rec.description
            ELSE 'Régularisation: Dépôt'
        END,
        bank_account_id,
        client_deposits_id,
        rec.amount,
        rec.id,
        rec.user_id,
        auth.uid() -- Logged as created by current user running the migration, or system
    );
    
    RAISE NOTICE 'Created accounting entry for transaction %', rec.id;
  END LOOP;
END;
$$;
