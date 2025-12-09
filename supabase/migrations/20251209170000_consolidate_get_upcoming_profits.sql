-- Migration: Supprime les versions conflictuelles de get_upcoming_profits et la recrée proprement.
-- Date: 2025-12-09
-- Description: Corrige une erreur "ambiguous_parameter" (42702) en s'assurant qu'une seule
--              définition de la fonction existe.

-- Step 1: Drop all potential conflicting versions of the function.
-- Supabase RPC requires named parameters, so we can't have overloads with the same name.
DROP FUNCTION IF EXISTS public.get_upcoming_profits();
DROP FUNCTION IF EXISTS public.get_upcoming_profits(TIMESTAMPTZ, TIMESTAMPTZ);


-- Step 2: Recreate the single, definitive version of the function.
CREATE OR REPLACE FUNCTION public.get_upcoming_profits(
    p_start_date TIMESTAMPTZ DEFAULT now(),
    p_end_date TIMESTAMPTZ DEFAULT (now() + interval '7 days')
)
RETURNS TABLE (
    user_id UUID,
    contract_id UUID,
    amount NUMERIC,
    expected_date TIMESTAMPTZ,
    contract_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.user_id,
        c.id as contract_id,
        (c.amount * c.monthly_rate) as amount,
        (c.start_date + (interval '1 month' * (c.months_paid + 1))) as expected_date,
        'Contrat #' || substr(c.id::text, 1, 8) as contract_name
    FROM public.contracts c
    WHERE c.status = 'active'
    AND (c.start_date + (interval '1 month' * (c.months_paid + 1))) BETWEEN p_start_date AND p_end_date;
END;
$$;

-- Grant permissions to the definitive version
GRANT EXECUTE ON FUNCTION public.get_upcoming_profits(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
