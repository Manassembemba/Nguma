-- Migration: Crée un déclencheur pour mettre à jour les soldes des comptes en temps réel.
-- Date: 2025-12-09
-- Description: Ce déclencheur s'assure que la table `company_accounts` est toujours
--              synchronisée avec les écritures insérées dans `accounting_entries`.

-- Step 1: Créer la fonction du déclencheur
CREATE OR REPLACE FUNCTION public.update_company_account_balances()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Mettre à jour le compte débité
    -- Un Débit augmente un Actif (Asset) mais diminue un Passif (Liability) ou un Revenu (Revenue).
    -- Pour simplifier le modèle, nous considérons que le solde reflète la "valeur" du compte.
    -- Un Débit sur un passif/revenu diminue ce que l'entreprise doit ou a gagné.
    -- Un Débit sur un actif augmente ce que l'entreprise possède.
    UPDATE public.company_accounts
    SET balance = 
        CASE 
            WHEN type IN ('asset') THEN balance + NEW.amount
            ELSE balance - NEW.amount
        END
    WHERE id = NEW.debit_account_id;

    -- Mettre à jour le compte crédité
    -- Un Crédit diminue un Actif mais augmente un Passif ou un Revenu.
    UPDATE public.company_accounts
    SET balance = 
        CASE 
            WHEN type IN ('asset') THEN balance - NEW.amount
            ELSE balance + NEW.amount
        END
    WHERE id = NEW.credit_account_id;

    RETURN NEW;
END;
$$;

-- Step 2: Créer le déclencheur qui appelle la fonction après chaque insertion
-- D'abord, supprimer l'ancien déclencheur s'il existe pour éviter les erreurs
DROP TRIGGER IF EXISTS on_new_accounting_entry ON public.accounting_entries;

-- Créer le nouveau déclencheur
CREATE TRIGGER on_new_accounting_entry
AFTER INSERT ON public.accounting_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_company_account_balances();

-- Step 3: Ajouter un commentaire pour la documentation
COMMENT ON TRIGGER on_new_accounting_entry ON public.accounting_entries
IS 'Met à jour automatiquement les soldes de la table company_accounts après chaque nouvelle écriture comptable.';

