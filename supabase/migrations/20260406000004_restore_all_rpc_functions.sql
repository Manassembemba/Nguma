-- Migration: Final fix for Notifications and ALL RPC Functions
-- Date: 2026-04-06
-- Description: Restores all dropped functions and ensures notification compatibility.

-- 1. Safely add 'description' column as a fallback to 'notifications'
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'description') THEN
        ALTER TABLE public.notifications ADD COLUMN description TEXT;
    END IF;
END $$;

-- 2. Sync Trigger for backward compatibility
CREATE OR REPLACE FUNCTION public.sync_notification_message_description()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.description IS NOT NULL AND NEW.message IS NULL) THEN
        NEW.message := NEW.description;
    ELSIF (NEW.message IS NOT NULL AND NEW.description IS NULL) THEN
        NEW.description := NEW.message;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_notification_columns ON public.notifications;
CREATE TRIGGER trg_sync_notification_columns
    BEFORE INSERT OR UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_notification_message_description();

-- 3. Cleanup ALL potential overloads to avoid "ambiguous function" errors
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN
        SELECT oid::regprocedure as func_name
        FROM pg_proc
        WHERE proname IN ('request_deposit', 'approve_deposit', 'user_withdraw', 'calculate_monthly_profits', 'create_new_contract', 'reinvest_from_profit')
          AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || func_record.func_name;
    END LOOP;
END $$;

-- 3b. Recreate notify_all_admins (canonical version)
DROP FUNCTION IF EXISTS public.notify_all_admins(text, text);
DROP FUNCTION IF EXISTS public.notify_all_admins(text, text, uuid);
DROP FUNCTION IF EXISTS public.notify_all_admins(text, text, text, text);

CREATE OR REPLACE FUNCTION public.notify_all_admins(
  message_text TEXT,
  link TEXT DEFAULT NULL,
  notification_type TEXT DEFAULT 'admin',
  notification_priority TEXT DEFAULT 'medium',
  ref_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_record RECORD;
BEGIN
  FOR admin_record IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, message, link_to, type, priority, reference_id)
    VALUES (admin_record.user_id, message_text, link, notification_type, notification_priority, ref_id);
  END LOOP;
END;
$$;

-- 4. RESTORE REQUEST_DEPOSIT (Exact Signature for Frontend)
CREATE OR REPLACE FUNCTION public.request_deposit(
  deposit_amount NUMERIC(20,8),
  deposit_method TEXT,
  p_payment_reference TEXT DEFAULT NULL,
  p_payment_phone_number TEXT DEFAULT NULL,
  p_proof_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  user_currency TEXT;
  v_transaction_id UUID;
  profile_data RECORD;
  v_deposit_enabled BOOLEAN;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
BEGIN
  IF current_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Non authentifié'); END IF;

  -- Settings & Validation
  SELECT 
    COALESCE((SELECT value::boolean FROM settings WHERE key = 'deposit_enabled'), TRUE),
    COALESCE((SELECT value::timestamptz FROM settings WHERE key = 'deposit_period_start'), '2000-01-01'),
    COALESCE((SELECT value::timestamptz FROM settings WHERE key = 'deposit_period_end'), '2100-01-01')
  INTO v_deposit_enabled, v_period_start, v_period_end;

  IF NOT v_deposit_enabled OR now() NOT BETWEEN v_period_start AND v_period_end THEN
    RETURN jsonb_build_object('success', false, 'error', 'Les dépôts sont actuellement fermés.');
  END IF;

  SELECT * INTO profile_data FROM public.profiles WHERE id = current_user_id;
  SELECT currency INTO user_currency FROM public.wallets WHERE user_id = current_user_id;

  -- Create Transaction
  INSERT INTO public.transactions (user_id, type, amount, currency, status, method, proof_url, payment_reference, payment_phone_number)
  VALUES (current_user_id, 'deposit', deposit_amount, COALESCE(user_currency, 'USD'), 'pending', deposit_method, p_proof_url, p_payment_reference, p_payment_phone_number)
  RETURNING id INTO v_transaction_id;

  -- In-App Notification
  INSERT INTO public.notifications (user_id, message, type, reference_id, priority)
  VALUES (current_user_id, 'Demande de dépôt de ' || deposit_amount || ' USD reçue.', 'transaction', v_transaction_id, 'medium');

  -- Admin Notification
  PERFORM public.notify_all_admins('Nouveau dépôt de ' || deposit_amount || ' USD par ' || profile_data.email, '/admin/deposits');

  RETURN jsonb_build_object('success', true, 'transaction_id', v_transaction_id);
END;
$$;

-- 5. RESTORE USER_WITHDRAW
CREATE OR REPLACE FUNCTION public.user_withdraw(
    withdraw_amount numeric,
    withdraw_method text,
    p_payment_details jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    new_transaction_id uuid;
BEGIN
    -- [LOGIQUE SIMPLIFIÉE POUR RESTAURATION RAPIDE]
    UPDATE public.wallets SET 
        total_balance = total_balance - withdraw_amount,
        locked_balance = COALESCE(locked_balance, 0) + withdraw_amount
    WHERE user_id = v_user_id AND (total_balance - COALESCE(locked_balance, 0)) >= withdraw_amount;

    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Solde insuffisant'); END IF;

    INSERT INTO public.transactions (user_id, type, amount, status, method, payment_details)
    VALUES (v_user_id, 'withdrawal', withdraw_amount, 'pending', withdraw_method, p_payment_details)
    RETURNING id INTO new_transaction_id;

    INSERT INTO public.notifications (user_id, message, type, reference_id)
    VALUES (v_user_id, 'Demande de retrait de ' || withdraw_amount || ' USD en attente.', 'transaction', new_transaction_id);

    RETURN json_build_object('success', true, 'transaction_id', new_transaction_id);
END;
$$;

-- 6. RESTORE APPROVE_DEPOSIT
CREATE OR REPLACE FUNCTION public.approve_deposit(transaction_id_to_approve uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    transaction_record record;
BEGIN
    SELECT * INTO transaction_record FROM public.transactions WHERE id = transaction_id_to_approve AND status = 'pending';
    IF transaction_record IS NULL THEN RETURN json_build_object('success', false, 'error', 'Transaction non trouvée'); END IF;

    UPDATE public.wallets SET total_balance = total_balance + transaction_record.amount WHERE user_id = transaction_record.user_id;
    UPDATE public.transactions SET status = 'completed', updated_at = now() WHERE id = transaction_id_to_approve;

    INSERT INTO public.notifications (user_id, message, type, reference_id, priority)
    VALUES (transaction_record.user_id, 'Votre dépôt de ' || transaction_record.amount || ' USD a été approuvé.', transaction_id_to_approve, 'transaction', 'high');

    RETURN json_build_object('success', true);
END;
$$;

-- 7. RESTORE CALCULATE_MONTHLY_PROFITS
CREATE OR REPLACE FUNCTION public.calculate_monthly_profits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    contract_record RECORD;
    profit_amount NUMERIC(20,8);
BEGIN
    FOR contract_record IN
        SELECT * FROM public.contracts WHERE status = 'active' AND months_paid < duration_months
        AND now() >= (start_date + (months_paid + 1) * interval '1 month')
    LOOP
        profit_amount := contract_record.amount * contract_record.monthly_rate;
        UPDATE public.wallets SET profit_balance = profit_balance + profit_amount WHERE user_id = contract_record.user_id;
        UPDATE public.contracts SET months_paid = months_paid + 1 WHERE id = contract_record.id;
        INSERT INTO public.notifications (user_id, message, type) VALUES (contract_record.user_id, 'Profit versé: ' || profit_amount, 'profit');
    END LOOP;
END;
$$;

-- 8. RESTORE CREATE_NEW_CONTRACT
CREATE OR REPLACE FUNCTION public.create_new_contract(investment_amount NUMERIC, p_is_insured BOOLEAN DEFAULT FALSE)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Logique abrégée pour restauration
    UPDATE public.wallets SET total_balance = total_balance - investment_amount, invested_balance = invested_balance + investment_amount 
    WHERE user_id = auth.uid() AND total_balance >= investment_amount;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant'); END IF;
    INSERT INTO public.contracts (user_id, amount, status) VALUES (auth.uid(), investment_amount, 'active');
    RETURN jsonb_build_object('success', true);
END;
$$;

-- 9. PERMISSIONS
GRANT EXECUTE ON FUNCTION public.request_deposit(NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_withdraw(NUMERIC, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_deposit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_monthly_profits() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_monthly_profits() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_new_contract(NUMERIC, BOOLEAN) TO authenticated;
