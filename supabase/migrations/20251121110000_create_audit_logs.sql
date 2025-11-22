-- Migration pour implémenter les Logs d'Audit
-- Date: 2025-11-21
-- Objectif: Traçabilité complète des actions sensibles

-- Table principale des logs d'audit
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Qui a effectué l'action
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_role TEXT, -- 'admin' ou 'investor'
  
  -- Quelle action
  action TEXT NOT NULL, -- Format: 'entity.action' (ex: 'deposit.approve')
  entity_type TEXT, -- Type d'entité: 'user', 'transaction', 'contract', 'setting'
  entity_id UUID, -- ID de l'entité concernée
  
  -- Détails de l'action
  old_values JSONB, -- État avant modification
  new_values JSONB, -- État après modification
  metadata JSONB, -- Informations supplémentaires (IP, user agent, etc.)
  
  -- Quand
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Validation
  CONSTRAINT valid_action_format CHECK (action ~ '^[a-z_]+\\.[a-z_]+$')
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id 
ON public.audit_logs(user_id) 
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
ON public.audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity 
ON public.audit_logs(entity_type, entity_id) 
WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
ON public.audit_logs(created_at DESC);

-- Commentaires
COMMENT ON TABLE public.audit_logs IS 'Journal d''audit de toutes les actions sensibles';
COMMENT ON COLUMN public.audit_logs.action IS 'Format: entity.action (ex: deposit.approve, user.create)';
COMMENT ON COLUMN public.audit_logs.old_values IS 'État avant modification (JSONB)';
COMMENT ON COLUMN public.audit_logs.new_values IS 'État après modification (JSONB)';
COMMENT ON COLUMN public.audit_logs.metadata IS 'Données contextuelles (IP, user agent, etc.)';

-- Fonction helper pour logger une action
CREATE OR REPLACE FUNCTION public.log_audit_action(
  p_action TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_user_role TEXT;
  v_log_id UUID;
BEGIN
  -- Récupérer l'utilisateur courant
  v_user_id := auth.uid();
  
  -- Si utilisateur authentifié, récupérer ses infos
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email 
    FROM auth.users 
    WHERE id = v_user_id;
    
    SELECT role::TEXT INTO v_user_role 
    FROM public.user_roles 
    WHERE user_id = v_user_id 
    LIMIT 1;
  END IF;

  -- Insérer le log
  INSERT INTO public.audit_logs (
    user_id, user_email, user_role,
    action, entity_type, entity_id,
    old_values, new_values, metadata
  ) VALUES (
    v_user_id, v_user_email, v_user_role,
    p_action, p_entity_type, p_entity_id,
    p_old_values, p_new_values, p_metadata
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour nettoyer les vieux logs (> 90 jours)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(
  p_retention_days INTEGER DEFAULT 90
) RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < now() - (p_retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction RPC pour récupérer les logs (admin seulement)
CREATE OR REPLACE FUNCTION public.get_audit_logs(
  p_user_id UUID DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
) RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  user_role TEXT,
  action TEXT,
  entity_type TEXT,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  -- Vérifier que l'appelant est admin
  SELECT role::TEXT INTO v_user_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_user_role != 'admin' THEN
    RAISE EXCEPTION 'Accès refusé: cette fonction est réservée aux administrateurs';
  END IF;

  -- Retourner les logs filtrés
  RETURN QUERY
  SELECT 
    al.id,
    al.user_id,
    al.user_email,
    al.user_role,
    al.action,
    al.entity_type,
    al.entity_id,
    al.old_values,
    al.new_values,
    al.metadata,
    al.created_at
  FROM public.audit_logs al
  WHERE 
    (p_user_id IS NULL OR al.user_id = p_user_id)
    AND (p_action IS NULL OR al.action = p_action)
    AND (p_entity_type IS NULL OR al.entity_type = p_entity_type)
    AND (p_start_date IS NULL OR al.created_at >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at <= p_end_date)
  ORDER BY al.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers automatiques sur tables critiques

-- 1. Trigger sur transactions (approbations/rejets)
CREATE OR REPLACE FUNCTION public.log_transaction_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM log_audit_action(
      'transaction.' || CASE 
        WHEN NEW.status = 'completed' THEN 'approve'
        WHEN NEW.status = 'failed' THEN 'reject'
        ELSE 'update'
      END,
      'transaction',
      NEW.id,
      jsonb_build_object('status', OLD.status, 'amount', OLD.amount),
      jsonb_build_object('status', NEW.status, 'amount', NEW.amount),
      jsonb_build_object('type', NEW.type, 'method', COALESCE(NEW.description, 'N/A'))
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_transaction_status_change
AFTER UPDATE OF status ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION log_transaction_status_change();

-- 2. Trigger sur user_roles (promotion/dégradation)
CREATE OR REPLACE FUNCTION public.log_user_role_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  -- Récupérer l'email de l'utilisateur concerné
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = COALESCE(NEW.user_id, OLD.user_id);

  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_action(
      'user.role_add',
      'user',
      NEW.user_id,
      NULL,
      jsonb_build_object('role', NEW.role::TEXT),
      jsonb_build_object('user_email', v_user_email)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_action(
      'user.role_change',
      'user',
      NEW.user_id,
      jsonb_build_object('role', OLD.role::TEXT),
      jsonb_build_object('role', NEW.role::TEXT),
      jsonb_build_object('user_email', v_user_email)
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_action(
      'user.role_remove',
      'user',
      OLD.user_id,
      jsonb_build_object('role', OLD.role::TEXT),
      NULL,
      jsonb_build_object('user_email', v_user_email)
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_user_role_change
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION log_user_role_change();

-- 3. Trigger sur contracts (modifications importantes)
CREATE OR REPLACE FUNCTION public.log_contract_change()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
BEGIN
  -- Déterminer le type d'action
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_action := 'contract.' || CASE
      WHEN NEW.status = 'cancelled' THEN 'cancel'
      WHEN NEW.status = 'refunded' THEN 'refund'
      WHEN NEW.status = 'completed' THEN 'complete'
      ELSE 'status_change'
    END;
  ELSIF OLD.amount IS DISTINCT FROM NEW.amount THEN
    v_action := 'contract.amount_change';
  ELSE
    v_action := 'contract.update';
  END IF;

  PERFORM log_audit_action(
    v_action,
    'contract',
    NEW.id,
    row_to_json(OLD)::JSONB,
    row_to_json(NEW)::JSONB,
    jsonb_build_object('user_id', NEW.user_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_contract_change
AFTER UPDATE ON public.contracts
FOR EACH ROW
WHEN (
  OLD.status IS DISTINCT FROM NEW.status OR
  OLD.amount IS DISTINCT FROM NEW.amount OR
  OLD.monthly_rate IS DISTINCT FROM NEW.monthly_rate
)
EXECUTE FUNCTION log_contract_change();

-- 4. Trigger sur settings (modifications de configuration)
CREATE OR REPLACE FUNCTION public.log_settings_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_audit_action(
    'setting.update',
    'setting',
    NEW.id,
    jsonb_build_object('key', OLD.key, 'value', OLD.value),
    jsonb_build_object('key', NEW.key, 'value', NEW.value),
    jsonb_build_object('description', NEW.description)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_settings_change
AFTER UPDATE ON public.settings
FOR EACH ROW
WHEN (OLD.value IS DISTINCT FROM NEW.value)
EXECUTE FUNCTION log_settings_change();

-- RLS Policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent consulter les logs
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Commentaires sur les fonctions
COMMENT ON FUNCTION public.log_audit_action IS 'Fonction helper pour enregistrer une action dans le journal d''audit';
COMMENT ON FUNCTION public.cleanup_old_audit_logs IS 'Nettoie les logs d''audit de plus de X jours';
COMMENT ON FUNCTION public.get_audit_logs IS 'Récupère les logs d''audit avec filtres (admin seulement)';
