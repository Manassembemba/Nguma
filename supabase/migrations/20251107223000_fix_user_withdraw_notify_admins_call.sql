-- Fix the call to notify_all_admins in user_withdraw RPC function.

CREATE OR REPLACE FUNCTION public.user_withdraw(
    withdraw_amount NUMERIC,
    withdraw_method TEXT,
    p_payment_reference TEXT DEFAULT NULL,
    p_payment_phone_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _user_id UUID := auth.uid();
    _wallet_id UUID;
    _profit_balance NUMERIC;
    _locked_balance NUMERIC;
    _transaction_id UUID;
BEGIN
    -- Get user's wallet and check balances
    SELECT id, profit_balance, locked_balance INTO _wallet_id, _profit_balance, _locked_balance
    FROM public.wallets
    WHERE user_id = _user_id;

    IF _wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Wallet not found.');
    END IF;

    -- Check if there are sufficient profits for withdrawal
    IF withdraw_amount <= 0 THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Le montant du retrait doit être positif.');
    END IF;

    IF _profit_balance < withdraw_amount THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Fonds insuffisants pour le retrait. Solde de profits: ' || _profit_balance);
    END IF;

    -- Deduct amount from profit_balance and add to locked_balance
    UPDATE public.wallets
    SET
        profit_balance = profit_balance - withdraw_amount,
        locked_balance = locked_balance + withdraw_amount,
        updated_at = now()
    WHERE id = _wallet_id;

    -- Create a pending withdrawal transaction
    INSERT INTO public.transactions (user_id, type, amount, currency, status, method, payment_reference, payment_phone_number, description)
    VALUES (
        _user_id,
        'withdrawal',
        withdraw_amount,
        (SELECT currency FROM public.wallets WHERE id = _wallet_id),
        'pending',
        withdraw_method,
        p_payment_reference,
        p_payment_phone_number,
        'Demande de retrait en attente'
    )
    RETURNING id INTO _transaction_id;

    -- Notify admins about the new pending withdrawal
    PERFORM public.notify_all_admins(
        'Nouvelle demande de retrait en attente',
        '/admin/pending-withdrawals', -- Corrected: link_to as second argument
        _transaction_id -- Corrected: transaction_id as third argument (reference_id)
    );

    RETURN jsonb_build_object('success', TRUE, 'transaction_id', _transaction_id);
END;
$$;
