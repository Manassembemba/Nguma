-- Migration: Fix Wallet Balance Protection Trigger to allow RPC updates
-- Date: 2026-04-10
-- Description: Autorise les mises à jour du solde effectuées via des fonctions RPC (SECURITY DEFINER)
-- tout en bloquant toujours les modifications manuelles directes via l'API REST.

CREATE OR REPLACE FUNCTION public.protect_wallet_balances()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    is_admin BOOLEAN;
    v_current_user TEXT;
BEGIN
    -- Récupérer l'utilisateur actuel de la DB
    v_current_user := current_user;

    -- Vérifier si l'utilisateur est admin (basé sur le JWT auth.uid())
    is_admin := COALESCE((SELECT public.has_role(auth.uid(), 'admin')), false);

    -- LOGIQUE DE BLOCAGE :
    -- On bloque UNIQUEMENT si l'utilisateur est authentifié via JWT (auth.role() = 'authenticated')
    -- ET que ce n'est PAS un admin
    -- ET que la modification est tentée directement via l'API REST (current_user = 'authenticated')
    
    -- Si current_user n'est PAS 'authenticated' (souvent 'postgres' ou le propriétaire), 
    -- cela signifie qu'une fonction SECURITY DEFINER est en train de faire la modification, 
    -- ce qui est autorisé.
    
    IF auth.role() = 'authenticated' 
       AND NOT is_admin 
       AND v_current_user = 'authenticated' THEN
        RAISE EXCEPTION 'Tentative de modification directe de solde détectée et bloquée.';
    END IF;

    RETURN NEW;
END;
$function$;

-- Notification de succès
COMMENT ON FUNCTION public.protect_wallet_balances() IS 'Protège les soldes contre les modifications REST directes tout en autorisant les fonctions RPC SECURITY DEFINER.';
