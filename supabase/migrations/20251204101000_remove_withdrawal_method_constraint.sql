-- Migration: Suppression de la contrainte restrictive sur withdrawal_verifications.method
-- Date: 2025-12-04
-- Description: Supprime la contrainte CHECK qui limitait le champ method à 'crypto' et 'mobile_money'
--              Permet maintenant d'utiliser n'importe quel code de méthode de paiement (mpesa_rdc, usdt_trc20, etc.)

-- Supprimer l'ancienne contrainte restrictive
ALTER TABLE public.withdrawal_verifications
DROP CONSTRAINT IF EXISTS valid_method;

-- Ajouter un commentaire pour documenter le changement
COMMENT ON COLUMN public.withdrawal_verifications.method IS 
'Code de la méthode de paiement utilisée pour le retrait. Accepte n''importe quel code défini dans payment_methods.code';
