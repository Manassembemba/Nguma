-- Migration: Désactivation des frais de retrait et des frais de méthodes de paiement
-- Date: 2025-12-04
-- Description: Met à zéro tous les frais de retrait et désactive les frais pour toutes les méthodes de paiement

-- ============================================================================
-- 1. DÉSACTIVATION DES FRAIS DE RETRAIT
-- ============================================================================

-- Mettre les frais de retrait à zéro (pourcentage et fixe)
UPDATE public.settings
SET value = '0', updated_at = now()
WHERE key IN ('withdrawal_fee_percent', 'withdrawal_fee_fixed');

-- Commentaire pour documentation
COMMENT ON COLUMN public.settings.value IS 'Frais de retrait désactivés le 2025-12-04 - withdrawal_fee_percent et withdrawal_fee_fixed mis à 0';

-- ============================================================================
-- 2. DÉSACTIVATION DES FRAIS DES MÉTHODES DE PAIEMENT
-- ============================================================================

-- Mettre toutes les méthodes de paiement en mode "sans frais"
UPDATE public.payment_methods
SET 
  fee_type = 'none',
  fee_fixed = 0,
  fee_percentage = 0,
  updated_at = now()
WHERE fee_type IS NOT NULL; -- Mise à jour uniquement si la colonne existe

-- Commentaire pour documentation
COMMENT ON TABLE public.payment_methods IS 'Frais de paiement désactivés le 2025-12-04 - tous les fee_type mis à ''none''';

-- ============================================================================
-- 3. VÉRIFICATION
-- ============================================================================

-- Afficher les paramètres de retrait pour vérification
DO $$
DECLARE
    v_fee_percent TEXT;
    v_fee_fixed TEXT;
BEGIN
    SELECT value INTO v_fee_percent FROM public.settings WHERE key = 'withdrawal_fee_percent';
    SELECT value INTO v_fee_fixed FROM public.settings WHERE key = 'withdrawal_fee_fixed';
    
    RAISE NOTICE 'Frais de retrait - Pourcentage: %, Fixe: %', v_fee_percent, v_fee_fixed;
END $$;

-- Afficher le nombre de méthodes de paiement sans frais
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.payment_methods WHERE fee_type = 'none';
    
    RAISE NOTICE 'Nombre de méthodes de paiement sans frais: %', v_count;
END $$;
