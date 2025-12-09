-- Migration: Script de réparation final pour la comptabilité.
-- Date: 2025-12-09
-- Description: Ce script garantit que les types des comptes sont corrects avant de 
--              lancer une réconciliation complète de toutes les écritures comptables.
--              Ceci corrige les erreurs de calcul des soldes.

DO $$
DECLARE
    v_entry RECORD;
BEGIN
    RAISE NOTICE 'Début de la réparation et réconciliation comptable finale...';

    -- Step 1: Forcer la mise à jour des types de compte pour garantir la cohérence.
    RAISE NOTICE 'Correction des types de comptes...';
    UPDATE public.company_accounts SET type = 'asset' WHERE name IN ('Banque Principale', 'Portefeuille Crypto');
    UPDATE public.company_accounts SET type = 'liability' WHERE name IN ('Dépôts Clients', 'Capital Investi Clients', 'Dettes Retraits');
    UPDATE public.company_accounts SET type = 'revenue' WHERE name = 'Revenus Frais';

    -- Step 2: Recalculer tous les soldes à partir d'un état propre.
    RAISE NOTICE 'Réinitialisation et recalcul des soldes...';
    
    -- Réinitialiser tous les soldes à zéro
    UPDATE public.company_accounts SET balance = 0;

    -- Parcourir toutes les écritures et appliquer la logique de calcul correcte.
    FOR v_entry IN SELECT * FROM public.accounting_entries ORDER BY transaction_date, created_at LOOP
        -- Mettre à jour le compte débité
        UPDATE public.company_accounts
        SET balance = 
            CASE 
                WHEN type = 'asset' THEN balance + v_entry.amount
                ELSE balance - v_entry.amount
            END
        WHERE id = v_entry.debit_account_id;

        -- Mettre à jour le compte crédité
        UPDATE public.company_accounts
        SET balance = 
            CASE 
                WHEN type = 'asset' THEN balance - v_entry.amount
                ELSE balance + v_entry.amount
            END
        WHERE id = v_entry.credit_account_id;
    END LOOP;

    RAISE NOTICE 'Réparation et réconciliation terminées avec succès.';
END;
$$;
