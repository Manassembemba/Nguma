-- Migration: Correction de approve_withdrawal - utiliser 'completed' au lieu de 'approved'
-- Date: 2025-12-04
-- Description: Corrige le status pour respecter la contrainte valid_transaction_status

-- Supprimer toutes les versions existantes
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT proname, oidvectortypes(proargtypes) as argtypes
        FROM pg_proc 
        WHERE proname = 'approve_withdrawal' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS public.approve_withdrawal(%s) CASCADE', r.argtypes);
    END LOOP;
END$$;

-- Créer la version corrigée
CREATE FUNCTION public.approve_withdrawal(
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
BEGIN
    IF p_proof_url IS NULL OR p_proof_url = '' THEN
        RETURN json_build_object('success', false, 'error', 'La preuve de transfert est obligatoire.');
    END IF;

    SELECT * INTO transaction_data 
    FROM public.transactions 
    WHERE id = transaction_id_to_approve 
    AND type = 'withdrawal' 
    AND status = 'pending';

    IF transaction_data IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction introuvable ou déjà traitée.');
    END IF;

    SELECT * INTO profile_data 
    FROM public.profiles 
    WHERE id = transaction_data.user_id;

    -- Mettre à jour avec status 'completed' au lieu de 'approved'
    UPDATE public.transactions
    SET 
        status = 'completed',
        proof_url = p_proof_url,
        updated_at = now()
    WHERE id = transaction_id_to_approve;

    -- Débloquer les fonds
    UPDATE public.wallets
    SET 
        locked_balance = locked_balance - transaction_data.amount,
        updated_at = now()
    WHERE user_id = transaction_data.user_id;

    -- Email avec preuve
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

    -- Notification in-app
    INSERT INTO public.notifications (user_id, title, message, type, priority, link)
    VALUES (
        transaction_data.user_id,
        'Retrait approuvé',
        'Votre retrait de ' || transaction_data.amount || ' USD a été approuvé et transféré. Consultez la preuve dans votre email.',
        'withdrawal',
        'high',
        '/wallet'
    );

    RETURN json_build_object('success', true, 'message', 'Retrait approuvé avec succès.');

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erreur: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_withdrawal(UUID, TEXT) TO authenticated;
