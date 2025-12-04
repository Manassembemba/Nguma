-- Migration: Ajout du système de preuve de transfert obligatoire pour retraits
-- Date: 2025-12-04
-- Description: Ajoute la colonne proof_url à transactions, crée le bucket storage,
--              et configure les RLS policies pour l'upload par les admins

-- 1. Ajouter la colonne proof_url à la table transactions
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS proof_url TEXT;

COMMENT ON COLUMN public.transactions.proof_url IS 
'URL de la preuve de paiement uploadée par l''admin lors de l''approbation du retrait (OBLIGATOIRE)';

-- 2. Créer le bucket storage pour les preuves de transfert
INSERT INTO storage.buckets (id, name, public)
VALUES ('withdrawal-proofs', 'withdrawal-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS Policy : Seuls les admins peuvent uploader
DROP POLICY IF EXISTS "Admins can upload withdrawal proofs" ON storage.objects;
CREATE POLICY "Admins can upload withdrawal proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'withdrawal-proofs'
  AND (
    SELECT role FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) IS NOT NULL
);

-- 4. RLS Policy : Tout le monde peut voir les preuves (pour les emails)
DROP POLICY IF EXISTS "Anyone can view withdrawal proofs" ON storage.objects;
CREATE POLICY "Anyone can view withdrawal proofs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'withdrawal-proofs');

-- 5. RLS Policy : Seuls les admins peuvent supprimer
DROP POLICY IF EXISTS "Admins can delete withdrawal proofs" ON storage.objects;
CREATE POLICY "Admins can delete withdrawal proofs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'withdrawal-proofs'
  AND (
    SELECT role FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) IS NOT NULL
);

-- Note : Le bucket est 'public' pour permettre l'affichage dans les emails
-- Les policies contrôlent qui peut uploader/supprimer
