-- Migration: Fix Withdrawal Details Logic and Description
-- Date: 2026-04-07
-- Description: Améliore la récupération des détails de paiement et remplit la colonne description des transactions.

CREATE OR REPLACE FUNCTION public.user_withdraw(
    withdraw_amount numeric,
    withdraw_method text,
    p_payment_details jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    new_transaction_id uuid;
    v_profile record;
    admin_record record;
    v_recipient_info TEXT := '';
    v_description TEXT;
    field_key TEXT;
    field_value TEXT;
BEGIN
    -- 1. Validation de l'authentification
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Non authentifié');
    END IF;

    -- 2. Logique de verrouillage des profits
    UPDATE public.wallets SET 
        profit_balance = profit_balance - withdraw_amount,
        locked_balance = COALESCE(locked_balance, 0) + withdraw_amount,
        updated_at = now()
    WHERE user_id = v_user_id AND profit_balance >= withdraw_amount;

    IF NOT FOUND THEN 
        RETURN json_build_object('success', false, 'error', 'Solde de profit insuffisant pour ce retrait.'); 
    END IF;

    -- 3. Construction intelligente de la description et des détails du bénéficiaire
    IF p_payment_details ? 'recipient_wallet' THEN
        v_recipient_info := p_payment_details->>'recipient_wallet';
    ELSIF p_payment_details ? 'recipient_number' THEN
        v_recipient_info := p_payment_details->>'recipient_number';
    ELSIF p_payment_details ? 'recipient_binance_id' THEN
        v_recipient_info := 'Binance ID: ' || (p_payment_details->>'recipient_binance_id');
    ELSIF p_payment_details ? 'account_number' THEN
        v_recipient_info := 'A/C: ' || (p_payment_details->>'account_number');
    ELSE
        v_recipient_info := COALESCE(p_payment_details->>'recipient_name', p_payment_details->>'account_name', 'Détails non fournis');
    END IF;

    v_description := 'Retrait via ' || withdraw_method || ' (' || v_recipient_info || ')';

    -- 4. Création de la transaction avec description
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

    INSERT INTO public.transactions (
        user_id, 
        type, 
        amount, 
        status, 
        method, 
        payment_details,
        description,
        currency
    )
    VALUES (
        v_user_id, 
        'withdrawal', 
        withdraw_amount, 
        'pending', 
        withdraw_method, 
        p_payment_details,
        v_description,
        'USD'
    )
    RETURNING id INTO new_transaction_id;

    -- 4.5 Populer transaction_metadata pour compatibilité avec l'admin UI
    IF p_payment_details IS NOT NULL AND p_payment_details != '{}'::jsonb THEN
        FOR field_key, field_value IN SELECT * FROM jsonb_each_text(p_payment_details)
        LOOP
            INSERT INTO public.transaction_metadata (transaction_id, field_key, field_value)
            VALUES (new_transaction_id, field_key, field_value)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    -- 5. Notifications In-App (Utilisateur)
    INSERT INTO public.notifications (user_id, message, type, reference_id, priority)
    VALUES (
        v_user_id, 
        'Votre demande de retrait de ' || withdraw_amount || ' USD est en cours de traitement.', 
        'transaction', 
        new_transaction_id,
        'medium'
    );

    -- 6. Notifications Administrateurs (In-App + Email Queue)
    FOR admin_record IN
        SELECT ur.user_id, p.email, p.first_name 
        FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.role = 'admin'
    LOOP
        -- In-App Admin
        INSERT INTO public.notifications (user_id, message, link_to, type, priority, reference_id)
        VALUES (
            admin_record.user_id, 
            'Nouveau retrait de ' || withdraw_amount || ' USD par ' || COALESCE(v_profile.email, 'Utilisateur'), 
            '/admin/withdrawals', 
            'admin_withdrawal', 
            'high', 
            new_transaction_id
        );

        -- Email Queue Admin
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'new_withdrawal_request',
            admin_record.user_id,
            admin_record.email,
            jsonb_build_object(
                'amount', withdraw_amount,
                'email', COALESCE(v_profile.email, 'N/A'),
                'userName', COALESCE(v_profile.first_name || ' ' || v_profile.last_name, 'Investisseur'),
                'transactionId', new_transaction_id,
                'withdrawalMethod', withdraw_method,
                'recipientName', v_recipient_info -- Utilise maintenant la description détaillée
            )
        );
    END LOOP;

    RETURN json_build_object(
        'success', true, 
        'transaction_id', new_transaction_id,
        'message', 'Demande de retrait enregistrée avec succès.'
    );

EXCEPTION WHEN OTHERS THEN
    -- Tentative de rollback manuel en cas d'erreur imprevue pour eviter les fonds bloqués
    -- Note: PostgreSQL gère le rollback de la transaction, mais c'est une sécurité supplémentaire
    RETURN json_build_object('success', false, 'error', 'Erreur lors du traitement : ' || SQLERRM);
END;
$$;

-- Mise à jour des permissions
GRANT EXECUTE ON FUNCTION public.user_withdraw(NUMERIC, TEXT, JSONB) TO authenticated;
