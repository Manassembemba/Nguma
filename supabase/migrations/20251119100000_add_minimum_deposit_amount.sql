-- 1. Add the minimum deposit amount to the settings table
INSERT INTO public.settings (key, value, type, description)
VALUES ('minimum_deposit_amount', '100', 'number', 'The minimum amount required for a user deposit.')
ON CONFLICT (key) DO NOTHING;

-- 2. Update the request_deposit function to enforce the minimum amount
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
    min_deposit_amount numeric;
BEGIN
    -- Get minimum deposit amount from settings
    SELECT value::numeric INTO min_deposit_amount
    FROM public.settings
    WHERE key = 'minimum_deposit_amount';

    -- Data validation
    IF deposit_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Le montant du dépôt doit être positif.');
    END IF;

    -- Enforce minimum deposit amount
    IF min_deposit_amount IS NOT NULL AND deposit_amount < min_deposit_amount THEN
        RETURN json_build_object('success', false, 'error', 'Le montant minimum du dépôt est de ' || min_deposit_amount || ' USD.');
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

    -- Notify admins about the new pending deposit
    PERFORM public.notify_all_admins(
        'Nouveau dépôt en attente de ' || (SELECT email FROM auth.users WHERE id = v_user_id),
        '/admin/deposits'
    );

    RETURN json_build_object('success', true);

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', 'Une erreur inattendue est survenue.');
END;
$$;
