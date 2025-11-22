-- Check if table exists
SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs');

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'audit_logs';

-- Try to insert a log manually using the helper function
DO $$
DECLARE
  v_id UUID;
BEGIN
  v_id := public.log_audit_action(
    'test.action',
    'test',
    gen_random_uuid(),
    jsonb_build_object('test', 'old'),
    jsonb_build_object('test', 'new'),
    jsonb_build_object('source', 'debug_script')
  );
  RAISE NOTICE 'Log inserted with ID: %', v_id;
END $$;

-- Check if the log is visible
SELECT * FROM public.audit_logs WHERE action = 'test.action';
