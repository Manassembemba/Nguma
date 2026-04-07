-- Migration: Update get_pending_withdrawals_with_profiles to include payment_details
-- Date: 2026-04-07

CREATE OR REPLACE FUNCTION public.get_pending_withdrawals_with_profiles()
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Ensure only admins can call this function
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Accès refusé. Seuls les administrateurs peuvent consulter les retraits en attente.';
    END IF;

    RETURN QUERY
    SELECT
        jsonb_build_object(
            'id', t.id,
            'user_id', t.user_id,
            'amount', t.amount,
            'currency', t.currency,
            'status', t.status,
            'method', t.method,
            'payment_reference', t.payment_reference,
            'payment_phone_number', t.payment_phone_number,
            'payment_details', t.payment_details, -- Added payment_details
            'description', t.description,
            'created_at', t.created_at,
            'updated_at', t.updated_at,
            'profile', jsonb_build_object(
                'email', p.email,
                'full_name', COALESCE(p.full_name, trim(concat_ws(' ', p.first_name, p.last_name))),
                'phone', p.phone
            )
        )
    FROM
        public.transactions t
    JOIN
        public.profiles p ON t.user_id = p.id
    WHERE
        t.type = 'withdrawal' AND t.status = 'pending'
    ORDER BY
        t.created_at ASC;
END;
$$;
