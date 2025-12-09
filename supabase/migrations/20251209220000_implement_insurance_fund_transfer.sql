-- Migration: Implémente le transfert de cash pour les frais d'assurance (CORRIGÉE).
-- Date: 2025-12-09
-- Description: Ce script sépare la définition de fonction (DDL) du code d'exécution (DML)
--              pour corriger l'erreur de syntaxe.

-- PARTIE 1: DÉFINITION DE LA FONCTION (au niveau supérieur)

-- Step 1.1: Supprimer l'ancienne fonction pour permettre la recréation.
DROP FUNCTION IF EXISTS public.create_new_contract(NUMERIC, BOOLEAN);

-- Step 1.2: Recréer la fonction `create_new_contract` avec la logique comptable complète.
CREATE OR REPLACE FUNCTION public.create_new_contract(
    investment_amount NUMERIC(20,8),
    p_is_insured BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    current_user_id UUID := auth.uid();
    user_wallet RECORD;
    current_monthly_rate NUMERIC(10,8);
    contract_duration_months INTEGER;
    new_contract_id UUID;
    v_insurance_fee NUMERIC(20,8);
    v_net_amount NUMERIC(20,8);
    v_deposits_liability_account_id UUID;
    v_invested_liability_account_id UUID;
    v_revenue_account_id UUID;
    v_bank_account_id_local UUID;
    v_insurance_fund_account_id_local UUID;
BEGIN
    v_insurance_fee := public.calculate_insurance_fee(investment_amount, p_is_insured);
    v_net_amount := investment_amount - v_insurance_fee;

    IF v_net_amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Montant net insuffisant.'); END IF;

    SELECT value::NUMERIC INTO current_monthly_rate FROM public.settings WHERE key = 'monthly_profit_rate';
    IF current_monthly_rate IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Taux de profit non défini.'); END IF;
    
    SELECT value::INTEGER INTO contract_duration_months FROM public.settings WHERE key = 'contract_duration_months';
    IF contract_duration_months IS NULL THEN contract_duration_months := 10; END IF;

    SELECT * INTO user_wallet FROM public.wallets WHERE user_id = current_user_id;
    IF user_wallet.total_balance < investment_amount THEN RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant.'); END IF;

    UPDATE public.wallets SET total_balance = total_balance - investment_amount, invested_balance = invested_balance + v_net_amount, updated_at = now() WHERE user_id = current_user_id;

    INSERT INTO public.contracts (user_id, amount, currency, monthly_rate, end_date, duration_months, is_insured, insurance_fee_paid)
    VALUES (current_user_id, v_net_amount, user_wallet.currency, current_monthly_rate, now() + (contract_duration_months || ' months')::INTERVAL, contract_duration_months, p_is_insured, v_insurance_fee)
    RETURNING id INTO new_contract_id;

    INSERT INTO public.transactions (description, user_id, type, amount, currency, reference_id)
    VALUES ('Nouveau contrat d''investissement', current_user_id, 'investment', v_net_amount, user_wallet.currency, new_contract_id);
    
    IF p_is_insured AND v_insurance_fee > 0 THEN
        INSERT INTO public.transactions (description, user_id, type, amount, currency, reference_id)
        VALUES ('Frais d''assurance du contrat', current_user_id, 'investment', v_insurance_fee, user_wallet.currency, new_contract_id);
    END IF;

    SELECT id INTO v_deposits_liability_account_id FROM public.company_accounts WHERE name = 'Dépôts Clients';
    SELECT id INTO v_invested_liability_account_id FROM public.company_accounts WHERE name = 'Capital Investi Clients';
    SELECT id INTO v_revenue_account_id FROM public.company_accounts WHERE name = 'Revenus Frais';
    SELECT id INTO v_bank_account_id_local FROM public.company_accounts WHERE name = 'Banque Principale';
    SELECT id INTO v_insurance_fund_account_id_local FROM public.company_accounts WHERE name = 'Fonds d''Assurance';

    INSERT INTO public.accounting_entries (description, debit_account_id, credit_account_id, amount, transaction_date)
    VALUES ('Allocation de capital contrat #' || substr(new_contract_id::text, 1, 8), v_deposits_liability_account_id, v_invested_liability_account_id, v_net_amount, now());

    IF v_insurance_fee > 0 THEN
        INSERT INTO public.accounting_entries (description, debit_account_id, credit_account_id, amount, transaction_date)
        VALUES ('Revenus sur frais d''assurance contrat #' || substr(new_contract_id::text, 1, 8), v_deposits_liability_account_id, v_revenue_account_id, v_insurance_fee, now());
        
        INSERT INTO public.accounting_entries (description, debit_account_id, credit_account_id, amount, transaction_date)
        VALUES ('Transfert interne au fonds d''assurance contrat #' || substr(new_contract_id::text, 1, 8), v_insurance_fund_account_id_local, v_bank_account_id_local, v_insurance_fee, now());
    END IF;

    RETURN jsonb_build_object('success', true, 'contract_id', new_contract_id);
END;
$$;


-- PARTIE 2: MANIPULATION DES DONNÉES ET RÉCONCILIATION (dans un bloc DO)
DO $$
DECLARE
    v_bank_account_id UUID;
    v_deposits_liability_account_id UUID;
    v_invested_liability_account_id UUID;
    v_revenue_account_id UUID;
    v_insurance_fund_account_id UUID;
    v_entry RECORD;
BEGIN
    RAISE NOTICE 'Début de la réconciliation comptable...';

    -- S'assurer que les comptes nécessaires existent
    INSERT INTO public.company_accounts (name, type) VALUES ('Fonds d''Assurance', 'asset') ON CONFLICT (name) DO NOTHING;
    UPDATE public.company_accounts SET type = 'asset' WHERE name IN ('Banque Principale', 'Portefeuille Crypto', 'Fonds d''Assurance');
    UPDATE public.company_accounts SET type = 'liability' WHERE name IN ('Dépôts Clients', 'Capital Investi Clients', 'Dettes Retraits');
    UPDATE public.company_accounts SET type = 'revenue' WHERE name = 'Revenus Frais';

    -- Vider les anciennes écritures pour éviter les doublons lors de la réconciliation
    DELETE FROM public.accounting_entries;

    -- Récupérer les IDs des comptes
    SELECT id INTO v_bank_account_id FROM public.company_accounts WHERE name = 'Banque Principale';
    SELECT id INTO v_deposits_liability_account_id FROM public.company_accounts WHERE name = 'Dépôts Clients';
    SELECT id INTO v_invested_liability_account_id FROM public.company_accounts WHERE name = 'Capital Investi Clients';
    SELECT id INTO v_revenue_account_id FROM public.company_accounts WHERE name = 'Revenus Frais';
    SELECT id INTO v_insurance_fund_account_id FROM public.company_accounts WHERE name = 'Fonds d''Assurance';

    -- Recréer les écritures pour les dépôts historiques
    INSERT INTO public.accounting_entries (description, debit_account_id, credit_account_id, amount, transaction_date)
    SELECT 'Dépôt historique pour ' || p.email, v_bank_account_id, v_deposits_liability_account_id, t.amount, t.created_at
    FROM public.transactions t JOIN public.profiles p ON t.user_id = p.id
    WHERE t.type = 'deposit' AND t.status = 'completed';

    -- Recréer les écritures pour les contrats (capital et frais)
    FOR v_entry IN SELECT c.id as contract_id, c.amount as net_amount, c.insurance_fee_paid as fee, c.created_at as tx_date FROM public.contracts c LOOP
        INSERT INTO public.accounting_entries (description, debit_account_id, credit_account_id, amount, transaction_date)
        VALUES ('Allocation de capital contrat #' || substr(v_entry.contract_id::text, 1, 8), v_deposits_liability_account_id, v_invested_liability_account_id, v_entry.net_amount, v_entry.tx_date);
        
        IF v_entry.fee > 0 THEN
            INSERT INTO public.accounting_entries (description, debit_account_id, credit_account_id, amount, transaction_date)
            VALUES ('Revenus sur frais d''assurance contrat #' || substr(v_entry.contract_id::text, 1, 8), v_deposits_liability_account_id, v_revenue_account_id, v_entry.fee, v_entry.tx_date);
            
            INSERT INTO public.accounting_entries (description, debit_account_id, credit_account_id, amount, transaction_date)
            VALUES ('Transfert interne au fonds d''assurance pour contrat #' || substr(v_entry.contract_id::text, 1, 8), v_insurance_fund_account_id, v_bank_account_id, v_entry.fee, v_entry.tx_date);
        END IF;
    END LOOP;

    -- Réinitialiser et recalculer les soldes finaux
    UPDATE public.company_accounts SET balance = 0;
    
    FOR v_entry IN SELECT * FROM public.accounting_entries ORDER BY transaction_date, created_at LOOP
        UPDATE public.company_accounts SET balance = CASE WHEN type = 'asset' THEN balance + v_entry.amount ELSE balance - v_entry.amount END WHERE id = v_entry.debit_account_id;
        UPDATE public.company_accounts SET balance = CASE WHEN type = 'asset' THEN balance - v_entry.amount ELSE balance + v_entry.amount END WHERE id = v_entry.credit_account_id;
    END LOOP;

    RAISE NOTICE 'Réconciliation finale terminée avec succès.';
END;
$$;