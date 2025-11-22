-- Migration pour implémenter le Rate Limiting
-- Date: 2025-11-21
-- Objectif: Protéger contre les attaques brute-force et l'abus d'API

-- Table pour tracker les tentatives par utilisateur/IP
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- Email, user_id, ou IP
  action TEXT NOT NULL, -- 'login', 'deposit', 'withdrawal', 'api_call'
  attempts INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(identifier, action)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_action 
ON public.rate_limits(identifier, action);

CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked_until 
ON public.rate_limits(blocked_until) 
WHERE blocked_until IS NOT NULL;

-- Commentaires
COMMENT ON TABLE public.rate_limits IS 'Tracking des tentatives pour rate limiting';
COMMENT ON COLUMN public.rate_limits.identifier IS 'Email, user_id, ou adresse IP';
COMMENT ON COLUMN public.rate_limits.action IS 'Type d''action: login, deposit, withdrawal, api_call';
COMMENT ON COLUMN public.rate_limits.blocked_until IS 'Timestamp jusqu''auquel l''utilisateur est bloqué';

-- Fonction RPC pour vérifier et mettre à jour le rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_action TEXT,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 15
) RETURNS JSONB AS $$
DECLARE
  v_record RECORD;
  v_allowed BOOLEAN := TRUE;
  v_remaining INTEGER;
  v_reset_at TIMESTAMPTZ;
  v_window_interval INTERVAL;
  v_block_interval INTERVAL;
BEGIN
  -- Calculer les intervalles
  v_window_interval := (p_window_minutes || ' minutes')::INTERVAL;
  v_block_interval := (p_window_minutes * 2 || ' minutes')::INTERVAL;

  -- Récupérer l'enregistrement existant
  SELECT * INTO v_record
  FROM public.rate_limits
  WHERE identifier = p_identifier AND action = p_action;

  -- Si actuellement bloqué
  IF v_record.id IS NOT NULL AND v_record.blocked_until IS NOT NULL AND v_record.blocked_until > now() THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'remaining', 0,
      'reset_at', v_record.blocked_until,
      'blocked', TRUE
    );
  END IF;

  -- Si pas d'enregistrement OU fenêtre expirée → créer/reset
  IF v_record.id IS NULL OR (now() - v_record.window_start) > v_window_interval THEN
    INSERT INTO public.rate_limits (identifier, action, attempts, window_start)
    VALUES (p_identifier, p_action, 1, now())
    ON CONFLICT (identifier, action) DO UPDATE
    SET 
      attempts = 1, 
      window_start = now(), 
      blocked_until = NULL, 
      updated_at = now()
    RETURNING * INTO v_record;
    
    RETURN jsonb_build_object(
      'allowed', TRUE,
      'remaining', p_max_attempts - 1,
      'reset_at', v_record.window_start + v_window_interval,
      'blocked', FALSE
    );
  END IF;

  -- Incrémenter les tentatives
  UPDATE public.rate_limits
  SET attempts = attempts + 1, updated_at = now()
  WHERE identifier = p_identifier AND action = p_action
  RETURNING * INTO v_record;

  -- Vérifier si limite dépassée
  IF v_record.attempts > p_max_attempts THEN
    -- Bloquer l'utilisateur
    UPDATE public.rate_limits
    SET blocked_until = now() + v_block_interval, updated_at = now()
    WHERE identifier = p_identifier AND action = p_action
    RETURNING blocked_until INTO v_reset_at;
    
    v_allowed := FALSE;
    v_remaining := 0;
  ELSE
    v_remaining := p_max_attempts - v_record.attempts;
    v_reset_at := v_record.window_start + v_window_interval;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'remaining', v_remaining,
    'reset_at', v_reset_at,
    'blocked', NOT v_allowed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour nettoyer les anciens enregistrements
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.rate_limits
  WHERE updated_at < now() - INTERVAL '24 hours'
  AND (blocked_until IS NULL OR blocked_until < now());
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction admin pour débloquer un utilisateur
CREATE OR REPLACE FUNCTION public.admin_unblock_rate_limit(
  p_identifier TEXT,
  p_action TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  -- Vérifier que l'appelant est admin
  SELECT role INTO v_user_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_user_role != 'admin' THEN
    RAISE EXCEPTION 'Accès refusé: action réservée aux administrateurs';
  END IF;

  -- Débloquer l'utilisateur
  UPDATE public.rate_limits
  SET 
    blocked_until = NULL,
    attempts = 0,
    window_start = now(),
    updated_at = now()
  WHERE identifier = p_identifier AND action = p_action;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Les admins peuvent voir tous les rate limits
CREATE POLICY "Admins can view all rate limits"
ON public.rate_limits FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Commentaires sur les fonctions
COMMENT ON FUNCTION public.check_rate_limit IS 'Vérifie si une action est autorisée et met à jour les compteurs de rate limiting';
COMMENT ON FUNCTION public.cleanup_old_rate_limits IS 'Nettoie les enregistrements de rate limiting de plus de 24h';
COMMENT ON FUNCTION public.admin_unblock_rate_limit IS 'Permet aux admins de débloquer un utilisateur rate-limité';
