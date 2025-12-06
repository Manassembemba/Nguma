
-- Migration: Recrée la fonction get_upcoming_profits pour assurer la cohérence des paramètres
-- Date: 2025-12-09
-- Description: Une erreur 400 Bad Request se produit lors de l'appel de get_upcoming_profits,
-- indiquant un probable conflit de signature de fonction ou un problème de cache de l'API.
-- Cette migration recrée la fonction avec la signature correcte pour forcer la mise à jour
-- de la définition côté PostgREST.

-- Supprimer l'ancienne fonction pour être sûr
DROP FUNCTION IF EXISTS public.get_upcoming_profits(TIMESTAMPTZ, TIMESTAMPTZ);

-- Recréer la fonction avec la signature et le corps corrects
CREATE OR REPLACE FUNCTION public.get_upcoming_profits(
    start_date TIMESTAMPTZ DEFAULT now(),
    end_date TIMESTAMPTZ DEFAULT (now() + interval '7 days')
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
        'Contract ' || c.id::text as contract_name
    FROM public.contracts c
    WHERE c.status = 'active'
    AND (c.start_date + (interval '1 month' * (c.months_paid + 1))) BETWEEN start_date AND end_date;
END;
$$;

-- Rétablir les permissions
GRANT EXECUTE ON FUNCTION public.get_upcoming_profits(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

