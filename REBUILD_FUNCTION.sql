-- ==============================================================================================
-- SCRIPT DE RECONSTRUCTION
-- Copiez et exécutez ce script pour restaurer la fonctionnalité de liste des investisseurs.
-- ==============================================================================================

-- Étape 1: Suppression de la fonction de test.
DROP FUNCTION IF EXISTS public.get_all_investors_test();

-- Étape 2: Création de la version "finale" et correcte de la fonction get_investor_list_details.
CREATE OR REPLACE FUNCTION public.get_investor_list_details(
  p_search_query TEXT DEFAULT NULL,
  p_page_num INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 10,
  p_status_filter TEXT DEFAULT NULL,
  p_date_from TEXT DEFAULT NULL,
  p_date_to TEXT DEFAULT NULL,
  p_min_invested NUMERIC DEFAULT NULL,
  p_max_invested NUMERIC DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_offset INTEGER;
  v_total_count INTEGER;
  v_result JSONB;
  v_date_from DATE;
  v_date_to DATE;
BEGIN
  -- Autorisation : Seuls les admins peuvent exécuter cette fonction.
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  v_offset := (p_page_num - 1) * p_page_size;
  v_date_from := NULLIF(p_date_from, '')::DATE;
  v_date_to := NULLIF(p_date_to, '')::DATE;

  -- Utilisation d'une CTE (Common Table Expression) avec un LEFT JOIN pour une logique de statut robuste
  WITH investors_with_status AS (
    SELECT
      p.id,
      p.first_name,
      p.last_name,
      p.email,
      p.phone,
      p.country,
      p.city,
      p.created_at,
      p.post_nom,
      COALESCE(c_stats.total_invested, 0) as total_invested,
      CASE
        WHEN c_stats.has_contracts IS NOT TRUE THEN 'New'
        WHEN c_stats.has_active_contract IS TRUE THEN 'Active'
        ELSE 'Inactive'
      END as investor_status
    FROM
      public.profiles p
    LEFT JOIN (
      SELECT
        user_id,
        COALESCE(SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END), 0) as total_invested,
        bool_or(status = 'active') as has_active_contract,
        count(*) > 0 as has_contracts
      FROM public.contracts
      GROUP BY user_id
    ) c_stats ON c_stats.user_id = p.id
  )
  -- Compter le nombre total de résultats après filtrage
  SELECT COUNT(id) INTO v_total_count
  FROM investors_with_status
  WHERE
    (p_search_query IS NULL OR first_name ILIKE '%' || p_search_query || '%' OR last_name ILIKE '%' || p_search_query || '%' OR email ILIKE '%' || p_search_query || '%')
    AND (p_status_filter IS NULL OR p_status_filter = 'all' OR investor_status = p_status_filter)
    AND (v_date_from IS NULL OR created_at >= v_date_from)
    AND (v_date_to IS NULL OR created_at < v_date_to + INTERVAL '1 day')
    AND (p_min_invested IS NULL OR total_invested >= p_min_invested)
    AND (p_max_invested IS NULL OR total_invested <= p_max_invested)
    AND (p_country IS NULL OR country = p_country)
    AND (p_city IS NULL OR city ILIKE p_city);

  -- Récupérer les données paginées pour la page actuelle
  SELECT jsonb_build_object(
    'data', COALESCE(jsonb_agg(row_to_json(row_data)), '[]'::jsonb),
    'count', v_total_count
  ) INTO v_result
  FROM (
    SELECT
      p.id, p.first_name, p.last_name, p.post_nom, p.email, p.phone, p.country, p.city, p.created_at,
      NULL as banned_until, -- La colonne n'existe pas dans profiles, on la laisse à NULL.
      (SELECT row_to_json(w) FROM public.wallets w WHERE w.user_id = p.id) as wallet,
      (SELECT COALESCE(jsonb_agg(c), '[]'::jsonb) FROM public.contracts c WHERE c.user_id = p.id) as contracts,
      iws.total_invested
    FROM public.profiles p
    JOIN investors_with_status iws ON p.id = iws.id
    WHERE
      (p_search_query IS NULL OR iws.first_name ILIKE '%' || p_search_query || '%' OR iws.last_name ILIKE '%' || p_search_query || '%' OR iws.email ILIKE '%' || p_search_query || '%')
      AND (p_status_filter IS NULL OR p_status_filter = 'all' OR iws.investor_status = p_status_filter)
      AND (v_date_from IS NULL OR iws.created_at >= v_date_from)
      AND (v_date_to IS NULL OR iws.created_at < v_date_to + INTERVAL '1 day')
      AND (p_min_invested IS NULL OR iws.total_invested >= p_min_invested)
      AND (p_max_invested IS NULL OR iws.total_invested <= p_max_invested)
      AND (p_country IS NULL OR iws.country = p_country)
      AND (p_city IS NULL OR iws.city ILIKE p_city)
    ORDER BY iws.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) as row_data;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
