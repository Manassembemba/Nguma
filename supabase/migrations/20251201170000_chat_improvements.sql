-- =====================================================
-- AMÉLIORATIONS SYSTÈME DE CHAT - NGUMA
-- =====================================================
-- Migration pour ajouter :
-- 1. Support multi-conversations
-- 2. Support fichiers/attachments
-- 3. Analytics
-- 4. Templates admin
-- 5. Recherche full-text
-- Date: 2025-12-01
-- =====================================================

-- =====================================================
-- 1. SUPPORT MULTI-CONVERSATIONS
-- =====================================================

-- Ajouter colonne is_active pour gérer la conversation active
ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Ajouter colonne title si elle n'existe pas déjà
ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS title TEXT;

-- Supprimer l'ancienne contrainte UNIQUE(user_id) si elle existe
ALTER TABLE chat_conversations 
DROP CONSTRAINT IF EXISTS chat_conversations_user_id_key;

-- STRATÉGIE: Désactiver toutes les conversations d'abord
UPDATE chat_conversations SET is_active = false;

-- Ensuite, activer UNIQUEMENT la conversation la plus récente pour chaque utilisateur
-- (celle avec le dernier message ou la plus récemment créée)
WITH most_recent_conversations AS (
  SELECT DISTINCT ON (user_id)
    id
  FROM chat_conversations
  WHERE status = 'open'
  ORDER BY user_id, COALESCE(last_message_at, created_at) DESC
)
UPDATE chat_conversations c
SET is_active = true
FROM most_recent_conversations mrc
WHERE c.id = mrc.id;

-- Maintenant on peut créer l'index unique EN TOUTE SÉCURITÉ
-- car on a garanti qu'il n'y a qu'une seule conversation active par utilisateur
DROP INDEX IF EXISTS idx_one_active_conversation;
CREATE UNIQUE INDEX idx_one_active_conversation 
ON chat_conversations(user_id) 
WHERE is_active = true AND status = 'open';

-- Index pour améliorer les requêtes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_is_active 
ON chat_conversations(is_active);

-- =====================================================
-- 2. TABLE ATTACHMENTS (FICHIERS)
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 10485760), -- Max 10 MB
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_chat_attachments_message_id 
ON chat_attachments(message_id);

-- RLS pour chat_attachments
ALTER TABLE chat_attachments ENABLE ROW LEVEL SECURITY;

-- Policy : Utilisateurs peuvent voir les attachments de leurs conversations
DROP POLICY IF EXISTS "Users can view attachments in their conversations" ON chat_attachments;
CREATE POLICY "Users can view attachments in their conversations"
ON chat_attachments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM chat_messages m
        INNER JOIN chat_conversations c ON m.conversation_id = c.id
        WHERE m.id = message_id AND (
            c.user_id = auth.uid() OR
            EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
        )
    )
);

-- Policy : Utilisateurs peuvent uploader des attachments à leurs messages
DROP POLICY IF EXISTS "Users can upload attachments to their messages" ON chat_attachments;
CREATE POLICY "Users can upload attachments to their messages"
ON chat_attachments FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM chat_messages m
        WHERE m.id = message_id AND m.sender_id = auth.uid()
    )
);

-- Policy : Admins peuvent tout voir
DROP POLICY IF EXISTS "Admins can view all attachments" ON chat_attachments;
CREATE POLICY "Admins can view all attachments"
ON chat_attachments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- =====================================================
-- 3. TABLE ANALYTICS
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    ai_answered BOOLEAN DEFAULT false,
    escalated_to_admin BOOLEAN DEFAULT false,
    first_response_time_seconds INTEGER,
    resolution_time_seconds INTEGER,
    user_satisfaction_score INTEGER CHECK (user_satisfaction_score BETWEEN 1 AND 5),
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Une seule entrée analytics par conversation
    UNIQUE(conversation_id)
);

-- Index pour analytics
CREATE INDEX IF NOT EXISTS idx_analytics_conversation 
ON chat_analytics(conversation_id);

CREATE INDEX IF NOT EXISTS idx_analytics_created_at 
ON chat_analytics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_ai_answered 
ON chat_analytics(ai_answered);

-- RLS pour analytics (Admin uniquement)
ALTER TABLE chat_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view analytics" ON chat_analytics;
CREATE POLICY "Admins can view analytics"
ON chat_analytics FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- =====================================================
-- 4. TABLE TEMPLATES ADMIN
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_reply_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL CHECK (length(trim(content)) > 0),
    category TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    usage_count INTEGER DEFAULT 0 CHECK (usage_count >= 0),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour templates
CREATE INDEX IF NOT EXISTS idx_templates_category 
ON admin_reply_templates(category);

CREATE INDEX IF NOT EXISTS idx_templates_usage_count 
ON admin_reply_templates(usage_count DESC);

-- RLS pour templates (Admin uniquement)
ALTER TABLE admin_reply_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage templates" ON admin_reply_templates;
CREATE POLICY "Admins can manage templates"
ON admin_reply_templates FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_template_timestamp ON admin_reply_templates;
CREATE TRIGGER trigger_update_template_timestamp
    BEFORE UPDATE ON admin_reply_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_template_timestamp();

-- =====================================================
-- 5. INDEX FULL-TEXT SEARCH
-- =====================================================

-- Index full-text pour recherche dans les messages
DROP INDEX IF EXISTS idx_chat_messages_fts;
CREATE INDEX idx_chat_messages_fts 
ON chat_messages 
USING gin(to_tsvector('french', message));

-- =====================================================
-- 6. NOUVELLES FONCTIONS RPC
-- =====================================================

-- Fonction 1: Rechercher dans les messages
CREATE OR REPLACE FUNCTION search_chat_messages(
    p_query TEXT,
    p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
    id UUID,
    conversation_id UUID,
    sender_id UUID,
    message TEXT,
    is_admin BOOLEAN,
    created_at TIMESTAMPTZ,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.conversation_id,
        m.sender_id,
        m.message,
        m.is_admin,
        m.created_at,
        ts_rank(to_tsvector('french', m.message), to_tsquery('french', p_query)) as rank
    FROM chat_messages m
    INNER JOIN chat_conversations c ON m.conversation_id = c.id
    WHERE 
        c.user_id = auth.uid() AND
        to_tsvector('french', m.message) @@ to_tsquery('french', p_query)
    ORDER BY rank DESC, m.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction 2: Créer une nouvelle conversation
CREATE OR REPLACE FUNCTION create_new_conversation(p_title TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;
    
    -- Désactiver toutes les conversations actives de l'utilisateur
    UPDATE chat_conversations
    SET is_active = false
    WHERE user_id = v_user_id AND is_active = true;
    
    -- Créer nouvelle conversation
    INSERT INTO chat_conversations (user_id, title, is_active, status, subject)
    VALUES (v_user_id, p_title, true, 'open', COALESCE(p_title, 'Nouvelle conversation'))
    RETURNING id INTO v_conversation_id;
    
    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction 3: Basculer vers une conversation existante
CREATE OR REPLACE FUNCTION switch_to_conversation(p_conversation_id UUID)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;
    
    -- Vérifier que la conversation appartient à l'utilisateur
    IF NOT EXISTS (
        SELECT 1 FROM chat_conversations 
        WHERE id = p_conversation_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Conversation not found or access denied';
    END IF;
    
    -- Désactiver toutes les conversations
    UPDATE chat_conversations
    SET is_active = false
    WHERE user_id = v_user_id;
    
    -- Activer la conversation sélectionnée
    UPDATE chat_conversations
    SET is_active = true
    WHERE id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction 4: Incrémenter le compteur d'utilisation d'un template
CREATE OR REPLACE FUNCTION increment_template_usage(p_template_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Vérifier que l'utilisateur est admin
    IF NOT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;
    
    UPDATE admin_reply_templates
    SET usage_count = usage_count + 1
    WHERE id = p_template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction 5: Obtenir la conversation active de l'utilisateur (mise à jour)
CREATE OR REPLACE FUNCTION get_or_create_user_conversation()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_conversation_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;
    
    -- Chercher une conversation active
    SELECT id INTO v_conversation_id
    FROM chat_conversations
    WHERE user_id = v_user_id AND is_active = true
    LIMIT 1;
    
    -- Si pas trouvée, créer une nouvelle conversation
    IF v_conversation_id IS NULL THEN
        INSERT INTO chat_conversations (user_id, subject, is_active)
        VALUES (v_user_id, 'Conversation de support', true)
        RETURNING id INTO v_conversation_id;
    END IF;
    
    RETURN v_conversation_id;
END;
$$;

-- =====================================================
-- COMMENTAIRES
-- =====================================================

COMMENT ON TABLE chat_attachments IS 'Fichiers attachés aux messages de chat';
COMMENT ON TABLE chat_analytics IS 'Métriques de performance du système de chat';
COMMENT ON TABLE admin_reply_templates IS 'Templates de réponses prédéfinies pour les admins';

COMMENT ON FUNCTION search_chat_messages(TEXT, INTEGER) IS 'Recherche full-text dans les messages de chat de l''utilisateur';
COMMENT ON FUNCTION create_new_conversation(TEXT) IS 'Crée une nouvelle conversation et désactive l''ancienne';
COMMENT ON FUNCTION switch_to_conversation(UUID) IS 'Bascule vers une conversation existante';
COMMENT ON FUNCTION increment_template_usage(UUID) IS 'Incrémente le compteur d''utilisation d''un template';
