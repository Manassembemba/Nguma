-- Migration: Corrige la logique comptable pour l'approbation des retraits
-- Date: 2025-12-11
-- Description: 
-- Met à jour la fonction `approve_withdrawal` pour débiter le compte de passif correct ('Dettes Retraits')
-- au lieu de 'Dépôts Clients', assurant ainsi que les bilans financiers sont exacts.

DROP FUNCTION IF EXISTS public.approve_withdrawal(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.approve_withdrawal(
    transaction_id_to_approve UUID,
    p_proof_url TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    transaction_data RECORD;
    profile_data RECORD;
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    payload JSONB;
    notification_message TEXT;
    
    -- Accounting variables
    v_bank_account_id UUID;
    v_withdrawal_liability_id UUID;
BEGIN
    -- Validate proof URL
    IF p_proof_url IS NULL OR p_proof_url = '' THEN
        RETURN json_build_object('success', false, 'error', 'La preuve de transfert est obligatoire.');
    END IF;

    -- Get the transaction
    SELECT * INTO transaction_data 
    FROM public.transactions 
    WHERE id = transaction_id_to_approve 
    AND type = 'withdrawal' 
    AND status = 'pending';

    IF transaction_data IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction introuvable ou déjà traitée.');
    END IF;

    -- Get user profile
    SELECT * INTO profile_data 
    FROM public.profiles 
    WHERE id = transaction_data.user_id;

    -- Update transaction
    UPDATE public.transactions
    SET 
        status = 'completed',
        proof_url = p_proof_url,
        updated_at = now()
    WHERE id = transaction_id_to_approve;

    -- Update wallet (deduct from locked_balance)
    UPDATE public.wallets
    SET 
        locked_balance = locked_balance - transaction_data.amount,
        updated_at = now()
    WHERE user_id = transaction_data.user_id;

    -- *** LOGIQUE COMPTABLE CORRIGÉE ***
    -- Débit: Dettes Retraits (Passif -) - On solde la dette de profit.
    -- Crédit: Banque Principale (Actif -) - L'argent sort de l'entreprise.
    SELECT id INTO v_bank_account_id FROM public.company_accounts WHERE name = 'Banque Principale';
    SELECT id INTO v_withdrawal_liability_id FROM public.company_accounts WHERE name = 'Dettes Retraits';

    IF v_bank_account_id IS NOT NULL AND v_withdrawal_liability_id IS NOT NULL THEN
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
            'Retrait approuvé pour ' || COALESCE(profile_data.first_name, 'Utilisateur') || ' ' || COALESCE(profile_data.last_name, ''),
            v_withdrawal_liability_id, -- Débit: Passif 'Dettes Retraits'
            v_bank_account_id,         -- Crédit: Actif 'Banque Principale'
            transaction_data.amount,
            transaction_id_to_approve,
            transaction_data.user_id,
            auth.uid()
        );
        
        -- (Note: les balances des comptes sont mises à jour par un trigger, donc pas de UPDATE manuel ici)
    END IF;
    -- ************************************

    -- Prepare and send email
    payload := jsonb_build_object(
        'template_id', 'withdrawal_approved_with_proof',
        'to', profile_data.email,
        'name', profile_data.first_name || ' ' || profile_data.last_name,
        'amount', transaction_data.amount,
        'method', transaction_data.method,
        'proof_url', p_proof_url,
        'date', to_char(now(), 'DD/MM/YYYY')
    );

    PERFORM net.http_post(
        url := project_url || '/functions/v1/send-resend-email',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := payload
    );

    -- Notification message
    notification_message := 'Retrait approuvé: Votre retrait de ' || transaction_data.amount || ' USD a été approuvé et transféré. Consultez la preuve dans votre email.';

    -- Create notification
    INSERT INTO public.notifications (user_id, message, link_to)
    VALUES (
        transaction_data.user_id,
        notification_message,
        '/wallet'
    );

    RETURN json_build_object('success', true, 'message', 'Retrait approuvé avec succès.');

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erreur interne du serveur: ' || SQLERRM);
END;
$$;
