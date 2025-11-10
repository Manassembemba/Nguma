-- Function to allow admins to reject a pending deposit.

CREATE OR REPLACE FUNCTION public.reject_deposit(
    transaction_id_to_reject uuid,
    reason text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    transaction_record record;
    is_admin_user boolean;
BEGIN
    -- 1. Check if the user is an admin
    SELECT is_admin(auth.uid()) INTO is_admin_user;
    IF NOT is_admin_user THEN
        RETURN json_build_object('success', false, 'error', 'Accès refusé. Seuls les administrateurs peuvent rejeter les dépôts.');
    END IF;

    -- 2. Validate the reason
    IF reason IS NULL OR trim(reason) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Une raison pour le rejet est obligatoire.');
    END IF;

    -- 3. Get the transaction details
    SELECT * INTO transaction_record
    FROM public.transactions
    WHERE id = transaction_id_to_reject AND type = 'deposit' AND status = 'pending';

    IF transaction_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction de dépôt en attente non trouvée.');
    END IF;

    -- 4. Update the transaction status and add rejection reason
    UPDATE public.transactions
    SET 
        status = 'failed',
        description = 'Rejeté par l''admin. Raison: ' || reason,
        updated_at = now()
    WHERE id = transaction_id_to_reject;

    -- 5. Create a notification for the user
    INSERT INTO public.notifications (user_id, message, reference_id, link_to)
    VALUES (
        transaction_record.user_id, 
        'Votre dépôt de ' || transaction_record.amount || ' a été rejeté. Raison: ' || reason, 
        transaction_id_to_reject, 
        '/wallet'
    );

    -- Also notify admins that the action was taken
    PERFORM public.notify_all_admins(
        'Le dépôt de ' || transaction_record.amount || ' pour ' || (SELECT email FROM public.profiles WHERE id = transaction_record.user_id) || ' a été rejeté.', 
        '/admin/deposits', 
        transaction_id_to_reject
    );

    RETURN json_build_object('success', true);

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', 'Une erreur inattendue est survenue lors du rejet du dépôt.');
END;
$$;
