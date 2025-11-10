CREATE OR REPLACE FUNCTION approve_deposits_in_bulk(transaction_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tx_id UUID;
  approved_count INT := 0;
  failed_ids UUID[] := ARRAY[]::UUID[];
  error_message TEXT;
BEGIN
  -- Ensure the user is an admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès non autorisé.';
  END IF;

  FOREACH tx_id IN ARRAY transaction_ids
  LOOP
    BEGIN
      -- We call the single approval function to reuse its logic and notifications
      PERFORM approve_deposit(tx_id);
      approved_count := approved_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        -- If approve_deposit raises an exception, we catch it and add the ID to the failed list
        failed_ids := array_append(failed_ids, tx_id);
    END;
  END LOOP;

  IF array_length(failed_ids, 1) > 0 THEN
    error_message := 'Certains dépôts n''ont pas pu être approuvés. IDs échoués : ' || array_to_string(failed_ids, ', ');
    RETURN jsonb_build_object('success', false, 'approved_count', approved_count, 'error', error_message);
  END IF;

  RETURN jsonb_build_object('success', true, 'approved_count', approved_count);
END;
$$;
