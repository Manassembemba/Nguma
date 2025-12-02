-- Migration to fix withdrawal rejection logic and add 'rejected' status.

-- Part 1: Add 'rejected' to the list of valid transaction statuses.
ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS valid_transaction_status;

ALTER TABLE public.transactions
ADD CONSTRAINT valid_transaction_status
CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'rejected'));

COMMENT ON CONSTRAINT valid_transaction_status ON public.transactions IS 'Ensures transaction status is one of the allowed values, including rejected.';

-- Part 2: Correct the accounting logic in the reject_withdrawal function.
-- The old function incorrectly added the amount to total_balance instead of
-- moving it from locked_balance back to profit_balance.
DROP FUNCTION IF EXISTS public.reject_withdrawal(uuid, text);
CREATE OR REPLACE FUNCTION public.reject_withdrawal(transaction_id_to_reject uuid, reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    transaction_record record;
    user_profile record;
    is_admin_user boolean;
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    payload JSONB;
    wallet_record record;
BEGIN
    SELECT public.has_role(auth.uid(), 'admin') INTO is_admin_user;
    IF NOT is_admin_user THEN
        RETURN json_build_object('success', false, 'error', 'Accès refusé.');
    END IF;

    SELECT * INTO transaction_record
    FROM public.transactions
    WHERE id = transaction_id_to_reject AND type = 'withdrawal' AND status = 'pending';

    IF transaction_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction de retrait en attente non trouvée ou déjà traitée.');
    END IF;
    
    SELECT * INTO wallet_record FROM public.wallets WHERE user_id = transaction_record.user_id;

    -- Ensure the locked balance is sufficient before proceeding
    IF wallet_record.locked_balance < transaction_record.amount THEN
      RAISE EXCEPTION 'Le solde verrouillé est insuffisant pour traiter ce rejet. Montant verrouillé : %, Montant de la transaction : %', wallet_record.locked_balance, transaction_record.amount;
    END IF;

    -- THIS IS THE FIX: Move amount from locked_balance back to profit_balance.
    UPDATE public.wallets
    SET
      locked_balance = locked_balance - transaction_record.amount,
      profit_balance = profit_balance + transaction_record.amount,
      updated_at = now()
    WHERE user_id = transaction_record.user_id;

    -- Update transaction status to 'rejected'
    UPDATE public.transactions
    SET status = 'rejected',
        updated_at = now()
    WHERE id = transaction_id_to_reject;

    -- Get user profile for notifications
    SELECT email, first_name, last_name INTO user_profile
    FROM public.profiles
    WHERE id = transaction_record.user_id;
    
    -- Mark admin notifications as read
    UPDATE public.notifications
    SET is_read = true
    WHERE reference_id = transaction_id_to_reject;

    -- Notify user of rejection
    INSERT INTO public.notifications (user_id, message, reference_id, link_to, type, priority)
    VALUES (
        transaction_record.user_id,
        'Votre retrait de ' || transaction_record.amount || ' USD a été rejeté. Raison: ' || reason,
        transaction_id_to_reject,
        '/transactions',
        'transaction',
        'high'
    );

    IF user_profile.email IS NOT NULL THEN
        payload := jsonb_build_object(
            'template_id', 'withdrawal_rejected',
            'to', user_profile.email,
            'name', user_profile.first_name || ' ' || user_profile.last_name,
            'amount', transaction_record.amount,
            'reason', reason
        );

        BEGIN
            PERFORM net.http_post(
                url := project_url || '/functions/v1/send-resend-email',
                headers := jsonb_build_object('Content-Type', 'application/json'),
                body := payload
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to send email notification: %', SQLERRM;
        END;
    END IF;

    RETURN json_build_object('success', true);

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', 'Erreur système: ' || SQLERRM);
END;
$$;
