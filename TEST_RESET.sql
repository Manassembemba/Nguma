-- ==============================================================================================
-- SCRIPT DE TEST "TABLE RONDE"
-- Copiez et exécutez ce script pour repartir de zéro.
-- ==============================================================================================

-- Étape 1: Suppression de toutes les fonctions existantes pour éviter les conflits.
DROP FUNCTION IF EXISTS public.get_investor_list_details(TEXT, INTEGER, INTEGER, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_investor_list_details(TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_investor_list_details();
DROP FUNCTION IF EXISTS public.get_investor_list_details_v2(TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_all_investors_test(); -- Suppression de la fonction de test si elle existe déjà.


-- Étape 2: Création d'une fonction de test extrêmement simple SANS paramètres.
-- Elle retourne simplement les 10 premiers utilisateurs.
CREATE OR REPLACE FUNCTION public.get_all_investors_test()
RETURNS JSONB AS $$
BEGIN
  -- Pas de vérification d'admin pour ce test, pour simplifier au maximum.
  RETURN (
    SELECT jsonb_build_object(
      'data', COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb)
    )
    FROM (
      SELECT id, email, first_name, last_name FROM public.profiles LIMIT 10
    ) p
  );
END;
$$ LANGUAGE plpgsql;
