-- Script de test d'envoi d'email
-- Exécutez ceci dans l'éditeur SQL de Supabase pour envoyer un email de test

-- REMPLACEZ 'votre-email@gmail.com' par votre vraie adresse email
DO $$
DECLARE
  test_email TEXT := 'votre-email@gmail.com'; -- CHANGEZ CECI
  test_user_id UUID;
  test_amount NUMERIC := 100.00;
BEGIN
  -- Récupérer un utilisateur de test (vous-même de préférence)
  SELECT id INTO test_user_id 
  FROM auth.users 
  WHERE email = test_email
  LIMIT 1;
  
  -- Si pas trouvé, utilisez le premier admin
  IF test_user_id IS NULL THEN
    SELECT id INTO test_user_id 
    FROM profiles 
    WHERE role = 'admin'
    LIMIT 1;
  END IF;
  
  -- Appeler la fonction d'envoi d'email
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-resend-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'template_id', 'deposit_approved',
      'to', test_email,
      'name', 'Test User',
      'amount', test_amount
    )
  );
  
  RAISE NOTICE 'Email de test envoyé à: %', test_email;
END $$;
