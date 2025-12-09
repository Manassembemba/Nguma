-- Migration: Corrige la fonction get_investor_list_details pour éviter l'erreur "relation filtered_users does not exist".
-- Date: 2025-12-10
-- Description: La version précédente utilisait un CTE (WITH) qui n'était pas visible dans la deuxième
--              partie de la requête. Cette version répète la clause WHERE, ce qui est la bonne approche.

-- 1. Supprimer l'ancienne fonction incorrecte
DROP FUNCTION IF EXISTS public.get_investor_list_details(TEXT, INTEGER, INTEGER, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT);

-- 2. Recréer la fonction avec la logique corrigée
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
  v_where_clause TEXT;
BEGIN
  -- Autorisation
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  v_offset := (p_page_num - 1) * p_page_size;

  -- Conversion sécurisée des dates
  BEGIN
    v_date_from := CASE WHEN p_date_from IS NOT NULL AND p_date_from <> '' THEN p_date_from::DATE ELSE NULL END;
    v_date_to := CASE WHEN p_date_to IS NOT NULL AND p_date_to <> '' THEN p_date_to::DATE ELSE NULL END;
  EXCEPTION WHEN OTHERS THEN
    v_date_from := NULL;
    v_date_to := NULL;
  END;
  
  -- Construire la clause WHERE une seule fois pour la réutiliser
  v_where_clause := format(
    'FROM public.profiles p
     JOIN auth.users u ON p.id = u.id
     LEFT JOIN (
       SELECT user_id, COALESCE(SUM(amount), 0) as total_invested
       FROM public.contracts
       WHERE status = ''active''
       GROUP BY user_id
     ) ci ON ci.user_id = p.id
     WHERE 
       (%L IS NULL OR p.first_name ILIKE ''%%'' || %L || ''%%'' OR p.last_name ILIKE ''%%'' || %L || ''%%'' OR u.email ILIKE ''%%'' || %L || ''%%'')
       AND (%L IS NULL OR p.created_at >= %L::TIMESTAMPTZ)
       AND (%L IS NULL OR p.created_at < (%L + INTERVAL ''1 day'')::TIMESTAMPTZ)
       AND (%L IS NULL OR COALESCE(ci.total_invested, 0) >= %L)
       AND (%L IS NULL OR COALESCE(ci.total_invested, 0) <= %L)
       AND (%L IS NULL OR p.country = %L)
       AND (%L IS NULL OR p.city ILIKE %L)',
    p_search_query, p_search_query, p_search_query, p_search_query,
    v_date_from, v_date_from,
    v_date_to, v_date_to,
    p_min_invested, p_min_invested,
    p_max_invested, p_max_invested,
    p_country, p_country,
    p_city, p_city
  );

  -- Compter le total
  EXECUTE 'SELECT COUNT(p.id) ' || v_where_clause INTO v_total_count;

  -- Récupérer les données paginées
  SELECT jsonb_build_object(
    'data', COALESCE(jsonb_agg(row_data), '[]'::jsonb),
    'count', v_total_count
  ) INTO v_result
  FROM (
    SELECT p.id, p.first_name, p.last_name, p.post_nom, u.email, p.phone, p.country, p.city, u.banned_until, p.created_at,
      (SELECT jsonb_build_object('total_balance', w.total_balance, 'invested_balance', w.invested_balance, 'profit_balance', w.profit_balance, 'currency', w.currency) FROM public.wallets w WHERE w.user_id = p.id),
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('status', c.status)), '[]'::jsonb) FROM public.contracts c WHERE c.user_id = p.id),
      ci.total_invested
    FROM public.profiles p
    JOIN auth.users u ON p.id = u.id
    LEFT JOIN public.wallets w ON w.user_id = p.id
    LEFT JOIN (
      SELECT user_id, COALESCE(SUM(amount), 0) as total_invested
      FROM public.contracts
      WHERE status = 'active'
      GROUP BY user_id
    ) ci ON ci.user_id = p.id
    WHERE 
      (p_search_query IS NULL OR p_search_query = '' OR p.first_name ILIKE '%' || p_search_query || '%' OR p.last_name ILIKE '%' || p_search_query || '%' OR u.email ILIKE '%' || p_search_query || '%')
      AND (v_date_from IS NULL OR p.created_at >= v_date_from)
      AND (v_date_to IS NULL OR p.created_at < (v_date_to + INTERVAL '1 day'))
      AND (p_min_invested IS NULL OR COALESCE(ci.total_invested, 0) >= p_min_invested)
      AND (p_max_invested IS NULL OR COALESCE(ci.total_invested, 0) <= p_max_invested)
      AND (p_country IS NULL OR p_country = '' OR p.country = p_country)
      AND (p_city IS NULL OR p_city = '' OR p.city ILIKE p_city)
    ORDER BY p.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) as row_data;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
