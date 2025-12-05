-- Migration: Améliorations gestion utilisateurs admin
-- Ajoute le filtre entityId à get_audit_logs et améliore get_investor_list_details

-- 1. Mise à jour de get_audit_logs avec filtre entity_id
CREATE OR REPLACE FUNCTION public.get_audit_logs(
  p_user_id UUID DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
) RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  user_role TEXT,
  action TEXT,
  entity_type TEXT,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  -- Vérifier que l'appelant est admin
  SELECT role::TEXT INTO v_user_role
  FROM public.user_roles
  WHERE user_roles.user_id = auth.uid()
  LIMIT 1;

  IF v_user_role != 'admin' THEN
    RAISE EXCEPTION 'Accès refusé: cette fonction est réservée aux administrateurs';
  END IF;

  -- Retourner les logs filtrés
  RETURN QUERY
  SELECT 
    al.id,
    al.user_id,
    al.user_email,
    al.user_role,
    al.action,
    al.entity_type,
    al.entity_id,
    al.old_values,
    al.new_values,
    al.metadata,
    al.created_at
  FROM public.audit_logs al
  WHERE 
    (p_user_id IS NULL OR al.user_id = p_user_id)
    AND (p_action IS NULL OR al.action = p_action)
    AND (p_entity_type IS NULL OR al.entity_type = p_entity_type)
    AND (p_entity_id IS NULL OR al.entity_id = p_entity_id)
    AND (p_start_date IS NULL OR al.created_at >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at <= p_end_date)
  ORDER BY al.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Mise à jour de get_investor_list_details avec filtres avancés
CREATE OR REPLACE FUNCTION public.get_investor_list_details(
  p_search_query TEXT DEFAULT NULL,
  p_page_num INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 10,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_min_invested NUMERIC DEFAULT NULL,
  p_max_invested NUMERIC DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_offset INTEGER;
  v_total_count INTEGER;
  v_result JSONB;
BEGIN
  -- Vérifier que l'appelant est admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Accès refusé: cette fonction est réservée aux administrateurs';
  END IF;

  v_offset := (p_page_num - 1) * p_page_size;

  -- Count total matching records
  SELECT COUNT(*) INTO v_total_count
  FROM public.profiles p
  LEFT JOIN public.wallets w ON w.user_id = p.id
  LEFT JOIN (
    SELECT user_id, COALESCE(SUM(amount), 0) as total_invested
    FROM public.contracts
    WHERE status = 'active'
    GROUP BY user_id
  ) ci ON ci.user_id = p.id
  WHERE 
    (p_search_query IS NULL OR p_search_query = '' OR 
      p.first_name ILIKE '%' || p_search_query || '%' OR 
      p.last_name ILIKE '%' || p_search_query || '%' OR 
      p.email ILIKE '%' || p_search_query || '%')
    AND (p_date_from IS NULL OR p.created_at >= p_date_from)
    AND (p_date_to IS NULL OR p.created_at <= p_date_to)
    AND (p_min_invested IS NULL OR COALESCE(ci.total_invested, 0) >= p_min_invested)
    AND (p_max_invested IS NULL OR COALESCE(ci.total_invested, 0) <= p_max_invested);

  -- Get paginated data
  SELECT jsonb_build_object(
    'data', COALESCE(jsonb_agg(row_data), '[]'::jsonb),
    'count', v_total_count
  ) INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', p.id,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'post_nom', p.post_nom,
      'email', p.email,
      'phone', p.phone,
      'banned_until', p.banned_until,
      'created_at', p.created_at,
      'wallet', CASE WHEN w.id IS NOT NULL THEN jsonb_build_object(
        'total_balance', COALESCE(w.total_balance, 0),
        'invested_balance', COALESCE(w.invested_balance, 0),
        'profit_balance', COALESCE(w.profit_balance, 0),
        'currency', w.currency
      ) ELSE NULL END,
      'contracts', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('status', c.status)), '[]'::jsonb)
        FROM public.contracts c
        WHERE c.user_id = p.id
      ),
      'total_invested', COALESCE(ci.total_invested, 0)
    ) as row_data
    FROM public.profiles p
    LEFT JOIN public.wallets w ON w.user_id = p.id
    LEFT JOIN (
      SELECT user_id, COALESCE(SUM(amount), 0) as total_invested
      FROM public.contracts
      WHERE status = 'active'
      GROUP BY user_id
    ) ci ON ci.user_id = p.id
    WHERE 
      (p_search_query IS NULL OR p_search_query = '' OR 
        p.first_name ILIKE '%' || p_search_query || '%' OR 
        p.last_name ILIKE '%' || p_search_query || '%' OR 
        p.email ILIKE '%' || p_search_query || '%')
      AND (p_date_from IS NULL OR p.created_at >= p_date_from)
      AND (p_date_to IS NULL OR p.created_at <= p_date_to)
      AND (p_min_invested IS NULL OR COALESCE(ci.total_invested, 0) >= p_min_invested)
      AND (p_max_invested IS NULL OR COALESCE(ci.total_invested, 0) <= p_max_invested)
    ORDER BY p.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) sub;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
