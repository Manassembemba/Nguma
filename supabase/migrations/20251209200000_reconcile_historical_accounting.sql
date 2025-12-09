-- Migration: Script de réconciliation unique pour corriger la comptabilité historique.
-- Date: 2025-12-09
-- Description: Ce script crée les écritures comptables manquantes pour les transactions passées
--              et recalcule les soldes des comptes pour assurer la cohérence des données.

DO $$
DECLARE
    v_bank_account_id UUID;
    v_deposits_liability_account_id UUID;
    v_invested_liability_account_id UUID;
    v_revenue_account_id UUID;
    v_entry RECORD;
BEGIN
    RAISE NOTICE 'Début de la réconciliation comptable...';

    -- Step 1: Récupérer les IDs des comptes principaux
    SELECT id INTO v_bank_account_id FROM public.company_accounts WHERE name = 'Banque Principale';
    SELECT id INTO v_deposits_liability_account_id FROM public.company_accounts WHERE name = 'Dépôts Clients';
    SELECT id INTO v_invested_liability_account_id FROM public.company_accounts WHERE name = 'Capital Investi Clients';
    SELECT id INTO v_revenue_account_id FROM public.company_accounts WHERE name = 'Revenus Frais';

    -- Step 2: Créer les écritures manquantes pour les DÉPÔTS approuvés
    RAISE NOTICE 'Création des écritures pour les dépôts passés...';
    INSERT INTO public.accounting_entries (description, debit_account_id, credit_account_id, amount, transaction_date)
    SELECT 
        'Dépôt historique approuvé pour ' || p.email || ' (Transac ID: ' || substr(t.id::text, 1, 8) || ')',
        v_bank_account_id,
        v_deposits_liability_account_id,
        t.amount,
        t.created_at
    FROM public.transactions t
    JOIN public.profiles p ON t.user_id = p.id
    WHERE t.type = 'deposit'
    AND t.status = 'completed'
    AND NOT EXISTS (SELECT 1 FROM public.accounting_entries ae WHERE ae.description LIKE '%' || t.id::text || '%');

    -- Step 3: Créer les écritures manquantes pour les INVESTISSEMENTS (capital)
    RAISE NOTICE 'Création des écritures pour les investissements passés (capital)...';
    INSERT INTO public.accounting_entries (description, debit_account_id, credit_account_id, amount, transaction_date)
    SELECT 
        'Investissement historique pour contrat #' || substr(t.reference_id::text, 1, 8),
        v_deposits_liability_account_id,
        v_invested_liability_account_id,
        t.amount,
        t.created_at
    FROM public.transactions t
    WHERE t.type = 'investment'
    AND t.description ILIKE 'Nouveau contrat d''investissement%'
    AND NOT EXISTS (SELECT 1 FROM public.accounting_entries ae WHERE ae.description LIKE '%' || t.reference_id::text || '%');

    -- Step 4: Créer les écritures manquantes pour les FRAIS D'ASSURANCE
    RAISE NOTICE 'Création des écritures pour les frais d''assurance passés...';
    INSERT INTO public.accounting_entries (description, debit_account_id, credit_account_id, amount, transaction_date)
    SELECT 
        'Frais d''assurance historiques pour contrat #' || substr(t.reference_id::text, 1, 8),
        v_deposits_liability_account_id,
        v_revenue_account_id,
        t.amount,
        t.created_at
    FROM public.transactions t
    WHERE t.type = 'investment'
    AND t.description = 'Frais d''assurance du contrat'
    AND NOT EXISTS (SELECT 1 FROM public.accounting_entries ae WHERE ae.description LIKE '%' || t.reference_id::text || '%');

    -- Step 5: Recalculer tous les soldes des comptes
    RAISE NOTICE 'Recalcul des soldes de tous les comptes...';
    
    -- Réinitialiser tous les soldes à zéro
    UPDATE public.company_accounts SET balance = 0;

    -- Parcourir toutes les écritures et appliquer la logique du déclencheur
    FOR v_entry IN SELECT * FROM public.accounting_entries ORDER BY transaction_date, created_at LOOP
        -- Mettre à jour le compte débité
        UPDATE public.company_accounts
        SET balance = 
            CASE 
                WHEN type IN ('asset') THEN balance + v_entry.amount
                ELSE balance - v_entry.amount
            END
        WHERE id = v_entry.debit_account_id;

        -- Mettre à jour le compte crédité
        UPDATE public.company_accounts
        SET balance = 
            CASE 
                WHEN type IN ('asset') THEN balance - v_entry.amount
                ELSE balance + v_entry.amount
            END
        WHERE id = v_entry.credit_account_id;
    END LOOP;

    RAISE NOTICE 'Réconciliation comptable terminée avec succès.';
END;
$$;