-- Migration: Configure Storage CORS
-- Description: Configure les règles CORS pour les buckets de stockage afin d'autoriser les uploads depuis le domaine de production et localhost.

-- S'assurer que les buckets existent
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('documents', 'documents', true),
  ('avatars', 'avatars', true),
  ('payment_proofs', 'payment_proofs', true),
  ('payment_method_logos', 'payment_method_logos', true),
  ('withdrawal-proofs', 'withdrawal-proofs', true),
  ('chat_attachments', 'chat_attachments', true)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets
SET cors_rules = '[
  {
    "allowed_origins": [
      "https://www.nguma.org",
      "https://nguma.org",
      "http://localhost:8080",
      "http://localhost:5173",
      "http://localhost:3000"
    ],
    "allowed_methods": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "allowed_headers": ["*"],
    "max_age_seconds": 3600
  }
]'
WHERE id IN (
  'documents',
  'avatars',
  'payment_proofs',
  'payment_method_logos',
  'withdrawal-proofs',
  'chat_attachments'
);
