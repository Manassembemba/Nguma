-- Mettre à jour la contrainte de vérification pour inclure 'thinking'
ALTER TABLE public.chat_conversations 
DROP CONSTRAINT IF EXISTS chat_conversations_ai_status_check;

ALTER TABLE public.chat_conversations 
ADD CONSTRAINT chat_conversations_ai_status_check 
CHECK (ai_status = ANY (ARRAY['idle'::text, 'thinking'::text, 'typing'::text, 'error'::text]));

-- S'assurer que le statut par défaut est idle
ALTER TABLE public.chat_conversations 
ALTER COLUMN ai_status SET DEFAULT 'idle';
