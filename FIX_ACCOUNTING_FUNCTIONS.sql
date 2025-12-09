-- ==============================================================================================
-- SCRIPT DE CORRECTION POUR LES FONCTIONS DE COMPTABILITÉ
-- Copiez et exécutez ce script complet dans votre éditeur SQL Supabase.
-- Il corrige l'erreur "column "transaction_id" does not exist" lors de l'approbation de dépôts.
-- ==============================================================================================

-- Étape 1: Recréer la fonction `approve_deposit` avec le nom de colonne corrigé.
CREATE OR REPLACE FUNCTION public.approve_deposit(transaction_id_to_approve UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_transaction RECORD;
    v_bank_account_id UUID;
    v_deposits_liability_account_id UUID;
BEGIN
    -- Authorization
    IF NOT is_admin(auth.uid()) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Permission non accordée.');
    END IF;

    -- Find transaction
    SELECT * INTO target_transaction
    FROM public.transactions
    WHERE id = transaction_id_to_approve AND status = 'pending' AND type = 'deposit';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transaction de dépôt en attente non trouvée.');
    END IF;

    -- Update transaction and wallet
    UPDATE public.transactions SET status = 'completed', updated_at = now() WHERE id = transaction_id_to_approve;
    UPDATE public.wallets SET total_balance = total_balance + target_transaction.amount WHERE user_id = target_transaction.user_id;

    -- *** LOGIQUE COMPTABLE CORRIGÉE ***
    -- Get account IDs
    SELECT id INTO v_bank_account_id FROM public.company_accounts WHERE name = 'Banque Principale';
    SELECT id INTO v_deposits_liability_account_id FROM public.company_accounts WHERE name = 'Dépôts Clients';
    
    -- Create accounting entry with the correct column name
    INSERT INTO public.accounting_entries (related_transaction_id, description, debit_account_id, credit_account_id, amount)
    VALUES (
        transaction_id_to_approve,
        'Approbation du dépôt de ' || target_transaction.amount || ' USD pour ' || (SELECT email FROM auth.users WHERE id = target_transaction.user_id),
        v_bank_account_id,
        v_deposits_liability_account_id,
        target_transaction.amount
    );
    -- **********************************

    -- Notify user
    INSERT INTO public.notifications (user_id, message, link_to)
    VALUES (target_transaction.user_id, 'Votre dépôt de ' || target_transaction.amount || ' ' || target_transaction.currency || ' a été approuvé.', '/wallet');

    RETURN jsonb_build_object('success', true, 'message', 'Dépôt approuvé avec succès.');
END;
$$;


-- Étape 2: Recréer la fonction `create_new_contract` avec le nom de colonne corrigé.
CREATE OR REPLACE FUNCTION public.create_new_contract(
    investment_amount NUMERIC(20,8),
    p_is_insured BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    -- Declarations
    current_user_id UUID := auth.uid();
    user_wallet RECORD;
    current_monthly_rate NUMERIC(10,8);
    contract_duration_months INTEGER;
    new_contract_id UUID;
    investment_tx_id UUID; -- Variable to store the new transaction ID
    insurance_tx_id UUID; -- Variable to store the insurance transaction ID
    result JSONB;
    v_insurance_fee NUMERIC(20,8);
    v_net_amount NUMERIC(20,8);
    user_profile RECORD;
    v_deposits_liability_account_id UUID;
    v_invested_liability_account_id UUID;
    v_revenue_account_id UUID;
BEGIN
    -- Logic...
    v_insurance_fee := public.calculate_insurance_fee(investment_amount, p_is_insured);
    v_net_amount := investment_amount - v_insurance_fee;

    IF v_net_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Le montant après déduction des frais d''assurance est insuffisant.');
    END IF;

    SELECT value::NUMERIC INTO current_monthly_rate FROM public.settings WHERE key = 'monthly_profit_rate';
    IF current_monthly_rate IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Taux de profit non défini.'); END IF;
    
    SELECT value::INTEGER INTO contract_duration_months FROM public.settings WHERE key = 'contract_duration_months';
    IF contract_duration_months IS NULL THEN contract_duration_months := 10; END IF;
    
    SELECT * INTO user_wallet FROM public.wallets WHERE user_id = current_user_id;
    IF user_wallet.total_balance < investment_amount THEN RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant.'); END IF;
    
    SELECT * INTO user_profile FROM public.profiles WHERE id = current_user_id;

    UPDATE public.wallets SET
        total_balance = total_balance - investment_amount,
        invested_balance = invested_balance + v_net_amount,
        updated_at = now()
    WHERE user_id = current_user_id;

    INSERT INTO public.contracts (user_id, amount, currency, monthly_rate, end_date, duration_months, is_insured, insurance_fee_paid)
    VALUES (current_user_id, v_net_amount, user_wallet.currency, current_monthly_rate, now() + (contract_duration_months || ' months')::INTERVAL, contract_duration_months, p_is_insured, v_insurance_fee)
    RETURNING id INTO new_contract_id;
    
    INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
    VALUES (current_user_id, 'investment', v_net_amount, user_wallet.currency, new_contract_id, 'Nouveau contrat d''investissement')
    RETURNING id INTO investment_tx_id; -- Get the ID of the new transaction

    IF p_is_insured AND v_insurance_fee > 0 THEN
        INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
        VALUES (current_user_id, 'investment', v_insurance_fee, user_wallet.currency, new_contract_id, 'Frais d''assurance du contrat')
        RETURNING id INTO insurance_tx_id; -- Get the ID of the insurance transaction
    END IF;

    -- *** LOGIQUE COMPTABLE CORRIGÉE ***
    SELECT id INTO v_deposits_liability_account_id FROM public.company_accounts WHERE name = 'Dépôts Clients';
    SELECT id INTO v_invested_liability_account_id FROM public.company_accounts WHERE name = 'Capital Investi Clients';
    SELECT id INTO v_revenue_account_id FROM public.company_accounts WHERE name = 'Revenus Frais';

    INSERT INTO public.accounting_entries (related_transaction_id, description, debit_account_id, credit_account_id, amount)
    VALUES (
        investment_tx_id,
        'Allocation de capital au contrat #' || substr(new_contract_id::text, 1, 8),
        v_deposits_liability_account_id,
        v_invested_liability_account_id,
        v_net_amount
    );

    IF v_insurance_fee > 0 THEN
        INSERT INTO public.accounting_entries (related_transaction_id, description, debit_account_id, credit_account_id, amount)
        VALUES (
            insurance_tx_id,
            'Revenus des frais d''assurance pour le contrat #' || substr(new_contract_id::text, 1, 8),
            v_deposits_liability_account_id,
            v_revenue_account_id,
            v_insurance_fee
        );
    END IF;
    -- ************************************
    
    result := jsonb_build_object('success', true, 'contract_id', new_contract_id);
    RETURN result;
END;
$$;
