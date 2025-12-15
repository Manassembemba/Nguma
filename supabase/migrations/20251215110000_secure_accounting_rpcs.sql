
-- Migration: Secure Accounting RPCs and Fix Batch Logic
-- Date: 2025-12-15
-- Description:
-- 1. Adds admin role checks to `generate_withdrawal_batch` and `process_payment_batch`.
-- 2. Updates `process_payment_batch` to handle transactions that might have been manually approved 
--    (preventing double accounting and double wallet deduction).

-- 1. Secure generate_withdrawal_batch
CREATE OR REPLACE FUNCTION public.generate_withdrawal_batch()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_batch_id UUID;
    batch_num TEXT;
    total NUMERIC := 0;
BEGIN
    -- Security Check
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Access denied. Admin role required.';
    END IF;

    -- Check if there are pending withdrawals
    IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE type = 'withdrawal' AND status = 'pending') THEN
        RETURN NULL;
    END IF;

    -- Generate batch number
    batch_num := public.generate_batch_number();

    -- Create Batch
    INSERT INTO public.payment_batches (batch_number, status, period_start, period_end)
    VALUES (batch_num, 'pending', now(), now())
    RETURNING id INTO new_batch_id;

    -- Insert Items
    INSERT INTO public.payment_batch_items (batch_id, user_id, amount, related_transaction_id)
    SELECT 
        new_batch_id,
        user_id,
        amount,
        id
    FROM public.transactions
    WHERE type = 'withdrawal' AND status = 'pending';

    -- Update Batch Total
    SELECT SUM(amount) INTO total FROM public.payment_batch_items WHERE batch_id = new_batch_id;
    
    UPDATE public.payment_batches 
    SET total_amount = COALESCE(total, 0)
    WHERE id = new_batch_id;

    RETURN new_batch_id;
END;
$$;


-- 2. Secure and Improve process_payment_batch
CREATE OR REPLACE FUNCTION public.process_payment_batch(
    p_batch_id UUID,
    p_proof_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    batch_record RECORD;
    item_record RECORD;
    transaction_record RECORD;
    bank_account_id UUID;
    liability_account_id UUID;
    v_total_processed_amount NUMERIC := 0;
BEGIN
    -- Security Check
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access denied. Admin role required.');
    END IF;

    -- Get Batch
    SELECT * INTO batch_record FROM public.payment_batches WHERE id = p_batch_id;
    
    IF batch_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Batch not found');
    END IF;

    IF batch_record.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Batch already paid');
    END IF;

    -- Get Accounts
    SELECT id INTO bank_account_id FROM public.company_accounts WHERE name = 'Banque Principale';
    SELECT id INTO liability_account_id FROM public.company_accounts WHERE name = 'Dettes Retraits'; -- Fixed from Dépôts Clients if needed, or keeping consistent

    -- Loop through items
    FOR item_record IN SELECT * FROM public.payment_batch_items WHERE batch_id = p_batch_id LOOP
        
        -- Check current status of the transaction
        -- It might have been manually approved in the meantime
        SELECT * INTO transaction_record FROM public.transactions WHERE id = item_record.related_transaction_id;

        IF transaction_record.status = 'pending' THEN
            -- NORMAL FLOW: Process the transaction
            
            -- Update Transaction
            UPDATE public.transactions
            SET 
                status = 'completed',
                proof_url = p_proof_url,
                updated_at = now()
            WHERE id = item_record.related_transaction_id;
            
            -- Deduct Locked Balance logic (as in approve_withdrawal)
            -- Usually request_withdrawal locks funds. 
            UPDATE public.wallets
            SET 
                locked_balance = locked_balance - item_record.amount,
                updated_at = now()
            WHERE user_id = item_record.user_id;

            -- Send Notification
            INSERT INTO public.notifications (user_id, title, message, type, priority, link)
            VALUES (
                item_record.user_id,
                'Retrait traité',
                'Votre retrait de ' || item_record.amount || ' USD a été traité dans le lot ' || batch_record.batch_number,
                'withdrawal',
                'high',
                '/wallet'
            );

            -- Add to total for accounting
            v_total_processed_amount := v_total_processed_amount + item_record.amount;

        ELSE
            -- Transaction was already processed (e.g. manually)
            -- Do NOT deduct wallet again
            -- Do NOT add to accounting total again
            -- Just mark item as paid
            NULL; 
        END IF;

        -- Always mark item as paid in the batch
        UPDATE public.payment_batch_items SET status = 'paid' WHERE id = item_record.id;
    END LOOP;

    -- Update Batch Status
    UPDATE public.payment_batches 
    SET 
        status = 'paid', 
        processed_at = now(),
        processed_by = auth.uid()
    WHERE id = p_batch_id;

    -- Create Accounting Entry (Only for what was actually processed in this run)
    IF v_total_processed_amount > 0 THEN
        IF bank_account_id IS NOT NULL AND liability_account_id IS NOT NULL THEN
            INSERT INTO public.accounting_entries (
                description,
                debit_account_id,
                credit_account_id,
                amount,
                created_by
            ) VALUES (
                'Payment Batch ' || batch_record.batch_number,
                liability_account_id, -- Debit Liability to decrease it
                bank_account_id,      -- Credit Asset to decrease it
                v_total_processed_amount,
                auth.uid()
            );
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'batch_id', p_batch_id, 'processed_amount', v_total_processed_amount);
END;
$$;
