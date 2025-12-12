-- Migration: Ajoute le filtre de statut à la fonction get_investor_list_details
-- Date: 2025-12-11
-- Description: Permet de filtrer les investisseurs par statut côté serveur (Active, Inactive, New)

-- 1. Supprimer la version précédente pour la recréer avec le nouveau paramètre
DROP FUNCTION IF EXISTS public.get_investor_list_details(TEXT, INTEGER, INTEGER, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT);

-- 2. Recréer la fonction avec le paramètre p_status_filter
CREATE OR REPLACE FUNCTION public.get_investor_list_details(
  p_search_query TEXT DEFAULT NULL,
  p_page_num INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 10,
  p_date_from TEXT DEFAULT NULL,
  p_date_to TEXT DEFAULT NULL,
  p_min_invested NUMERIC DEFAULT NULL,
  p_max_invested NUMERIC DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_status_filter TEXT DEFAULT NULL  -- Nouveau paramètre pour filtrer par statut
) RETURNS JSONB AS $$
DECLARE
  v_offset INTEGER;
  v_total_count INTEGER;
  v_result JSONB;
  v_date_from DATE;
  v_date_to DATE;
BEGIN
  -- Autorisation
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  v_offset := (p_page_num - 1) * p_page_size;
  v_date_from := NULLIF(p_date_from, '')::DATE;
  v_date_to := NULLIF(p_date_to, '')::DATE;

  -- Compter le total avec le filtre de statut
  SELECT COUNT(p.id) INTO v_total_count
  FROM public.profiles p
  LEFT JOIN (
    SELECT user_id, COALESCE(SUM(amount), 0) as total_invested, 
           jsonb_agg(jsonb_build_object('status', status)) as contracts
    FROM public.contracts GROUP BY user_id
  ) ci ON ci.user_id = p.id
  WHERE
    (p_search_query IS NULL OR p.first_name ILIKE '%' || p_search_query || '%' OR p.last_name ILIKE '%' || p_search_query || '%' OR p.email ILIKE '%' || p_search_query || '%')
    AND (v_date_from IS NULL OR p.created_at >= v_date_from)
    AND (v_date_to IS NULL OR p.created_at < v_date_to + INTERVAL '1 day')
    AND (p_min_invested IS NULL OR COALESCE(ci.total_invested, 0) >= p_min_invested)
    AND (p_max_invested IS NULL OR COALESCE(ci.total_invested, 0) <= p_max_invested)
    AND (p_country IS NULL OR p.country = p_country)
    AND (p_city IS NULL OR p.city = p_city)
    AND (p_status_filter IS NULL OR p_status_filter = 'all' OR 
         CASE 
           WHEN ci.contracts IS NULL OR jsonb_array_length(ci.contracts) = 0 THEN p_status_filter = 'New'
           WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(ci.contracts) AS c WHERE c->>'status' = 'active') THEN p_status_filter = 'Active'
           ELSE p_status_filter = 'Inactive'
         END);

  -- Récupérer les données paginées avec le filtre de statut
  SELECT jsonb_build_object(
    'data', COALESCE(jsonb_agg(row_to_json(row_data)), '[]'::jsonb),
    'count', v_total_count
  ) INTO v_result
  FROM (
    SELECT
      p.id, p.first_name, p.last_name, p.post_nom, p.email, p.phone, p.country, p.city,
      NULL as banned_until,
      p.created_at,
      (SELECT row_to_json(w) FROM public.wallets w WHERE w.user_id = p.id) as wallet,
      ci.contracts as contracts,
      ci.total_invested
    FROM public.profiles p
    LEFT JOIN (
      SELECT user_id, COALESCE(SUM(amount), 0) as total_invested, 
             COALESCE(jsonb_agg(jsonb_build_object('status', status)), '[]'::jsonb) as contracts
      FROM public.contracts GROUP BY user_id
    ) ci ON ci.user_id = p.id
    WHERE
      (p_search_query IS NULL OR p.first_name ILIKE '%' || p_search_query || '%' OR p.last_name ILIKE '%' || p_search_query || '%' OR p.email ILIKE '%' || p_search_query || '%')
      AND (v_date_from IS NULL OR p.created_at >= v_date_from)
      AND (v_date_to IS NULL OR p.created_at < v_date_to + INTERVAL '1 day')
      AND (p_min_invested IS NULL OR COALESCE(ci.total_invested, 0) >= p_min_invested)
      AND (p_max_invested IS NULL OR COALESCE(ci.total_invested, 0) <= p_max_invested)
      AND (p_country IS NULL OR p.country = p_country)
      AND (p_city IS NULL OR p.city = p_city)
      AND (p_status_filter IS NULL OR p_status_filter = 'all' OR 
           CASE 
             WHEN ci.contracts IS NULL OR jsonb_array_length(ci.contracts) = 0 THEN p_status_filter = 'New'
             WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(ci.contracts) AS c WHERE c->>'status' = 'active') THEN p_status_filter = 'Active'
             ELSE p_status_filter = 'Inactive'
           END)
    ORDER BY p.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) as row_data;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;