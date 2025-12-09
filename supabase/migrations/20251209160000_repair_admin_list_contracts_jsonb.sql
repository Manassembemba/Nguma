-- Migration: Répare la fonction admin_list_contracts en standardisant le type de retour sur JSONB.
-- Date: 2025-12-09
-- Description: Cette migration remplace la fonction existante pour corriger une erreur de coercion
-- entre les types JSON et JSONB dans la fonction COALESCE.

-- Supprimer l'ancienne fonction pour permettre le changement de type de retour
DROP FUNCTION IF EXISTS public.admin_list_contracts(TEXT, TEXT, INT, INT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_list_contracts(
    p_search_query TEXT DEFAULT '',
    p_status_filter TEXT DEFAULT 'all',
    p_page_num INT DEFAULT 1,
    p_page_size INT DEFAULT 10,
    p_date_from TEXT DEFAULT NULL,
    p_date_to TEXT DEFAULT NULL
)
RETURNS JSONB -- Correction: Le type de retour est maintenant JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_offset INT;
    v_contracts JSONB; -- Correction: La variable est maintenant JSONB
    v_total_count BIGINT;
    v_query TEXT;
    v_date_from DATE;
    v_date_to DATE;
BEGIN
    -- Authorization
    IF NOT is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Accès non autorisé. Seuls les administrateurs peuvent voir tous les contrats.';
    END IF;

    -- Handle potential NULLs
    IF p_page_num IS NULL THEN p_page_num := 1; END IF;
    IF p_page_size IS NULL THEN p_page_size := 10; END IF;
    IF p_search_query IS NULL THEN p_search_query := ''; END IF;
    IF p_status_filter IS NULL THEN p_status_filter := 'all'; END IF;

    v_offset := (p_page_num - 1) * p_page_size;

    -- Safe casting of text dates
    BEGIN
        v_date_from := CASE WHEN p_date_from IS NOT NULL AND p_date_from <> '' THEN p_date_from::DATE ELSE NULL END;
        v_date_to := CASE WHEN p_date_to IS NOT NULL AND p_date_to <> '' THEN p_date_to::DATE ELSE NULL END;
    EXCEPTION WHEN OTHERS THEN
        v_date_from := NULL;
        v_date_to := NULL;
    END;

    -- Build the base query
    v_query := '
        FROM contracts c
        LEFT JOIN profiles p ON c.user_id = p.id
        WHERE (
            $1 IS NULL OR $1 = '''' OR
            p.first_name ILIKE ''%'' || $1 || ''%'' OR
            p.last_name ILIKE ''%'' || $1 || ''%'' OR
            p.email ILIKE ''%'' || $1 || ''%'' OR
            c.id::text ILIKE ''%'' || $1 || ''%''
        ) AND (
            $2 IS NULL OR $2 = ''all'' OR
            c.status::text = $2
        ) AND (
            $3 IS NULL OR c.created_at >= $3::timestamp
        ) AND (
            $4 IS NULL OR c.created_at < ($4 + interval ''1 day'')::timestamp
        )
    ';

    -- Get total count
    EXECUTE 'SELECT COUNT(*) ' || v_query INTO v_total_count USING p_search_query, p_status_filter, v_date_from, v_date_to;

    -- Get paginated data
    EXECUTE '
        SELECT jsonb_agg(contract_data)
        FROM (
            SELECT
                c.*,
                p.first_name,
                p.last_name,
                p.email
            ' || v_query || '
            ORDER BY c.created_at DESC
            LIMIT $5
            OFFSET $6
        ) as contract_data
    ' INTO v_contracts USING p_search_query, p_status_filter, v_date_from, v_date_to, p_page_size, v_offset;

    -- Return result
    RETURN jsonb_build_object(
        'data', COALESCE(v_contracts, '[]'::jsonb),
        'count', v_total_count
    );
END;
$$;
