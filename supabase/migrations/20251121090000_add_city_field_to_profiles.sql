-- Migration pour ajouter le champ city et améliorer la gestion des pays
-- Date: 2025-11-21

-- Ajouter le champ city pour séparer la ville de l'adresse
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;

-- Ajouter un commentaire pour clarifier que country stocke maintenant le code ISO
COMMENT ON COLUMN public.profiles.country IS 'ISO 3166-1 alpha-2 country code (e.g., CD, FR, BE, CM, SN)';

-- Ajouter un commentaire pour le champ city
COMMENT ON COLUMN public.profiles.city IS 'City name where the user resides';
