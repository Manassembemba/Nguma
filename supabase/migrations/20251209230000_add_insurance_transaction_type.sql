-- Migration: Ajoute un type de transaction 'assurance' et met à jour la logique de création de contrat.
-- Date: 2025-12-09

-- Step 1: Mettre à jour la contrainte sur la table des transactions pour inclure 'assurance'.
-- On supprime l'ancienne contrainte...
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS valid_transaction_type;

-- ...et on la recrée avec la nouvelle valeur.
ALTER TABLE public.transactions
ADD CONSTRAINT valid_transaction_type 
CHECK (type IN ('deposit', 'withdrawal', 'profit', 'refund', 'investment', 'assurance', 'admin_credit'));


-- Step 2: Mettre à jour la fonction `create_new_contract` pour utiliser le nouveau type.
-- On la supprime pour la recréer proprement.
DROP FUNCTION IF EXISTS public.create_new_contract(NUMERIC, BOOLEAN);

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
        -- *** MODIFICATION ICI: 'investment' devient 'assurance' ***
        INSERT INTO public.transactions (description, user_id, type, amount, currency, reference_id)
        VALUES ('Frais d''assurance du contrat', current_user_id, 'assurance', v_insurance_fee, user_wallet.currency, new_contract_id);
    END IF;

    -- Logique comptable...
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
