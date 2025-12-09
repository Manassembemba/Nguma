-- Migration: Version finale et stabilisée de la fonction get_investor_list_details.
-- Date: 2025-12-10
-- Description: Cette version revient à une structure simple et éprouvée, sans construction
--              de requête dynamique complexe, pour éliminer définitivement les erreurs de type (coerce).

-- 1. Supprimer toutes les versions précédentes pour un état propre.
DROP FUNCTION IF EXISTS public.get_investor_list_details(TEXT, INTEGER, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_investor_list_details(TEXT, INTEGER, INTEGER, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT);

-- 2. Recréer la fonction avec la logique la plus simple et la plus sûre.
CREATE OR REPLACE FUNCTION public.get_investor_list_details(
  p_search_query TEXT DEFAULT NULL,
  p_page_num INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 10,
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
  -- Autorisation
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  v_offset := (p_page_num - 1) * p_page_size;

  -- Conversion sécurisée des dates
  v_date_from := NULLIF(p_date_from, '')::DATE;
  v_date_to := NULLIF(p_date_to, '')::DATE;

  -- Compter le total des enregistrements
  SELECT COUNT(p.id) INTO v_total_count
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  LEFT JOIN (
    SELECT user_id, COALESCE(SUM(amount), 0) as total_invested
    FROM public.contracts
    WHERE status = 'active'
    GROUP BY user_id
  ) ci ON ci.user_id = p.id
  WHERE 
    (p_search_query IS NULL OR p.first_name ILIKE '%' || p_search_query || '%' OR p.last_name ILIKE '%' || p_search_query || '%' OR u.email ILIKE '%' || p_search_query || '%')
    AND (v_date_from IS NULL OR p.created_at >= v_date_from)
    AND (v_date_to IS NULL OR p.created_at < v_date_to + INTERVAL '1 day')
    AND (p_min_invested IS NULL OR COALESCE(ci.total_invested, 0) >= p_min_invested)
    AND (p_max_invested IS NULL OR COALESCE(ci.total_invested, 0) <= p_max_invested)
    AND (p_country IS NULL OR p.country = p_country)
    AND (p_city IS NULL OR p.city ILIKE p_city);

  -- Récupérer les données paginées
  SELECT jsonb_build_object(
    'data', COALESCE(jsonb_agg(row_to_json(row_data)), '[]'::jsonb),
    'count', v_total_count
  ) INTO v_result
  FROM (
    SELECT
      p.id, p.first_name, p.last_name, p.post_nom, u.email, p.phone, p.country, p.city, u.banned_until, p.created_at,
      (SELECT row_to_json(w) FROM public.wallets w WHERE w.user_id = p.id) as wallet,
      (SELECT COALESCE(jsonb_agg(c), '[]'::jsonb) FROM public.contracts c WHERE c.user_id = p.id) as contracts,
      ci.total_invested
    FROM public.profiles p
    JOIN auth.users u ON p.id = u.id
    LEFT JOIN (
      SELECT user_id, COALESCE(SUM(amount), 0) as total_invested
      FROM public.contracts
      WHERE status = 'active'
      GROUP BY user_id
    ) ci ON ci.user_id = p.id
    WHERE 
      (p_search_query IS NULL OR p.first_name ILIKE '%' || p_search_query || '%' OR p.last_name ILIKE '%' || p_search_query || '%' OR u.email ILIKE '%' || p_search_query || '%')
      AND (v_date_from IS NULL OR p.created_at >= v_date_from)
      AND (v_date_to IS NULL OR p.created_at < v_date_to + INTERVAL '1 day')
      AND (p_min_invested IS NULL OR COALESCE(ci.total_invested, 0) >= p_min_invested)
      AND (p_max_invested IS NULL OR COALESCE(ci.total_invested, 0) <= p_max_invested)
      AND (p_country IS NULL OR p.country = p_country)
      AND (p_city IS NULL OR p.city ILIKE p_city)
    ORDER BY p.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) as row_data;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
