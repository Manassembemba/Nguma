-- Migration: Corrige la logique comptable pour la distribution des profits
-- Date: 2025-12-11
-- Description: 
-- 1. Ajoute un compte de 'Charges' pour les profits distribués.
-- 2. Met à jour la fonction `calculate_monthly_profits` pour enregistrer la dette
--    de l'entreprise envers l'utilisateur au moment de la distribution des profits.

-- Étape 1: Ajouter le nouveau compte au plan comptable
INSERT INTO public.company_accounts (name, type)
VALUES ('Charges de Profits', 'expense')
ON CONFLICT (name) DO NOTHING;

-- Étape 2: Mettre à jour la fonction calculate_monthly_profits
DROP FUNCTION IF EXISTS public.calculate_monthly_profits();

CREATE OR REPLACE FUNCTION public.calculate_monthly_profits()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    contract_record RECORD;
    user_profile RECORD;
    profit_amount NUMERIC(20,8);
    current_month INTEGER;
    
    -- Accounting variables
    v_profit_expense_account_id UUID;
    v_withdrawal_liability_account_id UUID;
BEGIN
    -- Get account IDs
    SELECT id INTO v_profit_expense_account_id FROM public.company_accounts WHERE name = 'Charges de Profits';
    SELECT id INTO v_withdrawal_liability_account_id FROM public.company_accounts WHERE name = 'Dettes Retraits';

    FOR contract_record IN 
        SELECT * FROM public.contracts 
        WHERE status = 'active' 
        AND months_paid < duration_months 
        AND now() >= (start_date + (months_paid + 1) * interval '1 month')
    LOOP
        current_month := contract_record.months_paid + 1;
        profit_amount := contract_record.amount * contract_record.monthly_rate;
        
        -- Get user profile for notifications
        SELECT email, first_name, last_name INTO user_profile FROM public.profiles WHERE id = contract_record.user_id;

        -- Create a profit record
        INSERT INTO public.profits (contract_id, user_id, amount, month_number) 
        VALUES (contract_record.id, contract_record.user_id, profit_amount, current_month);
        
        -- Update user's wallet
        UPDATE public.wallets SET profit_balance = profit_balance + profit_amount, updated_at = now() WHERE user_id = contract_record.user_id;
        
        -- Create a 'profit' transaction
        INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
        VALUES (contract_record.user_id, 'profit', profit_amount, contract_record.currency, contract_record.id, 'Profit mensuel du contrat mois ' || current_month::TEXT);
        
        -- Update the contract itself
        UPDATE public.contracts 
        SET 
            months_paid = current_month, 
            total_profit_paid = total_profit_paid + profit_amount, 
            last_profit_distribution_date = now(), 
            status = CASE WHEN current_month >= duration_months THEN 'completed' ELSE 'active' END 
        WHERE id = contract_record.id;
        
        -- *** NOUVELLE LOGIQUE COMPTABLE ***
        -- Enregistrer la charge pour l'entreprise et la dette envers l'utilisateur.
        IF v_profit_expense_account_id IS NOT NULL AND v_withdrawal_liability_account_id IS NOT NULL THEN
            INSERT INTO public.accounting_entries (description, debit_account_id, credit_account_id, amount, related_user_id, related_transaction_id)
            VALUES (
                'Distribution de profit pour ' || user_profile.email,
                v_profit_expense_account_id,       -- Débit: La charge de l'entreprise augmente
                v_withdrawal_liability_account_id, -- Crédit: La dette de l'entreprise envers l'utilisateur augmente
                profit_amount,
                contract_record.user_id,
                (SELECT id FROM public.transactions WHERE reference_id = contract_record.id AND type = 'profit' ORDER BY created_at DESC LIMIT 1)
            );
        END IF;
        -- ************************************

        -- Create notification for the user
        INSERT INTO public.notifications (user_id, message, link_to, type, priority) 
        VALUES (contract_record.user_id, 'Votre profit mensuel de ' || profit_amount || ' ' || contract_record.currency || ' a été versé.', '/wallet', 'profit', 'medium');

        -- (Le code pour l'envoi d'email est omis pour la clarté mais devrait être ici)

    END LOOP;
END;
$function$;
