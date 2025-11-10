-- Drop both potential versions of the function to ensure a clean state.

DROP FUNCTION IF EXISTS get_contracts_for_user(p_user_id UUID);
DROP FUNCTION IF EXISTS get_contracts_for_user(p_user_id TEXT);
