CREATE OR REPLACE FUNCTION reject_deposits_in_bulk(transaction_ids UUID[], reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tx_id UUID;
  rejected_count INT := 0;
  failed_ids UUID[] := ARRAY[]::UUID[];
  error_message TEXT;
BEGIN
  -- Ensure the user is an admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès non autorisé.';
  END IF;

  -- Validate reason
  IF reason IS NULL OR trim(reason) = '' THEN
    RAISE EXCEPTION 'La raison du rejet est obligatoire.';
  END IF;

  FOREACH tx_id IN ARRAY transaction_ids
  LOOP
    BEGIN
      -- We call the single rejection function to reuse its logic
      PERFORM reject_deposit(tx_id, reason);
      rejected_count := rejected_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        -- If reject_deposit raises an exception, catch it
        failed_ids := array_append(failed_ids, tx_id);
    END;
  END LOOP;

  IF array_length(failed_ids, 1) > 0 THEN
    error_message := 'Certains dépôts n''ont pas pu être rejetés. IDs échoués : ' || array_to_string(failed_ids, ', ');
    RETURN jsonb_build_object('success', false, 'rejected_count', rejected_count, 'error', error_message);
  END IF;

  RETURN jsonb_build_object('success', true, 'rejected_count', rejected_count);
END;
$$;
