-- Debugging request_deposit to isolate the admin notification error.

CREATE OR REPLACE FUNCTION public.request_deposit(
    deposit_amount numeric,
    deposit_method text,
    p_payment_reference text DEFAULT NULL,
    p_payment_phone_number text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    profile_data record;
BEGIN
    -- Data validation
    IF deposit_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Le montant du dépôt doit être positif.');
    END IF;

    -- Get user profile to check for completion
    SELECT * INTO profile_data FROM public.profiles WHERE id = v_user_id;
    IF profile_data.first_name IS NULL OR profile_data.last_name IS NULL OR profile_data.phone IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Veuillez compléter votre profil avant de faire un dépôt.');
    END IF;

    -- Check if user wallet exists
    IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE user_id = v_user_id) THEN
        RETURN json_build_object('success', false, 'error', 'Portefeuille non trouvé.');
    END IF;

    -- Insert the pending deposit transaction
    INSERT INTO public.transactions (user_id, amount, type, status, method, payment_reference, payment_phone_number)
    VALUES (v_user_id, deposit_amount, 'deposit', 'pending', deposit_method, p_payment_reference, p_payment_phone_number);

    -- Notify all admins about the new deposit request (with isolated error handling)
    BEGIN
        PERFORM public.notify_all_admins('Nouvelle demande de dépôt de ' || deposit_amount || ' USD par ' || profile_data.email, '/admin/deposits');
    EXCEPTION
        WHEN OTHERS THEN
            RETURN json_build_object('success', false, 'error', 'Erreur de notification admin: ' || SQLERRM);
    END;

    RETURN json_build_object('success', true);

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', 'Une erreur inattendue est survenue.');
END;
$$;
