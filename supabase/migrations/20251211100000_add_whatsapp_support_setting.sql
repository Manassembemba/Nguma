-- Add WhatsApp support number to settings
INSERT INTO public.settings (key, value, description)
VALUES 
  ('support_whatsapp_number', '+243838953447', 'Numéro de téléphone WhatsApp affiché sur la page de support pour les utilisateurs actifs.')
ON CONFLICT (key) DO NOTHING;
