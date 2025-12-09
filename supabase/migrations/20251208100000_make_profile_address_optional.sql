-- Rend les champs country, city, et address optionnels dans la table profiles

ALTER TABLE public.profiles
ALTER COLUMN country DROP NOT NULL,
ALTER COLUMN city DROP NOT NULL,
ALTER COLUMN address DROP NOT NULL;
