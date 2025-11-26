-- Migration: Ajout du support d'images pour les méthodes de paiement
-- Description: Permet d'uploader des logos/images personnalisés pour chaque méthode

-- ============================================================================
-- 1. CRÉATION DU BUCKET STORAGE POUR LES LOGOS
-- ============================================================================

-- Créer le bucket pour les logos de méthodes de paiement
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment_method_logos', 'payment_method_logos', true)
ON CONFLICT (id) DO NOTHING;

-- Politique d'accès public en lecture
CREATE POLICY "Public can view payment method logos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'payment_method_logos' );

-- Politique d'upload pour les admins uniquement
CREATE POLICY "Admins can upload payment method logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( 
  bucket_id = 'payment_method_logos' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Politique de suppression pour les admins
CREATE POLICY "Admins can delete payment method logos"
ON storage.objects FOR DELETE
TO authenticated
USING ( 
  bucket_id = 'payment_method_logos' 
  AND public.has_role(auth.uid(), 'admin')
);

-- ============================================================================
-- 2. AJOUT DE LA COLONNE image_url
-- ============================================================================

-- Ajouter la colonne image_url à payment_methods
ALTER TABLE public.payment_methods
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Ajouter la colonne image_url à payment_categories
ALTER TABLE public.payment_categories
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ============================================================================
-- 3. COMMENTAIRES
-- ============================================================================

COMMENT ON COLUMN payment_methods.image_url IS 'URL de l''image/logo de la méthode de paiement (stockée dans payment_method_logos bucket)';
COMMENT ON COLUMN payment_categories.image_url IS 'URL de l''image/logo de la catégorie (stockée dans payment_method_logos bucket)';

-- ============================================================================
-- 4. EXEMPLES D'UTILISATION (COMMENTAIRES)
-- ============================================================================

-- Pour uploader un logo:
-- 1. Upload le fichier dans le bucket 'payment_method_logos'
-- 2. Récupérer l'URL publique
-- 3. UPDATE payment_methods SET image_url = 'https://...' WHERE code = 'mpesa_rdc';

-- Les images peuvent être:
-- - Logos des opérateurs (M-Pesa, Airtel, Orange)
-- - Logos des banques (Ecobank, Equity)
-- - Logos des services (Western Union, MoneyGram, Binance, USDT)
