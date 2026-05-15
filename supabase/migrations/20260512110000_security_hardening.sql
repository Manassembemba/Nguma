-- Migration: Security Hardening v2
-- Description: Corrige les politiques RLS permissives, restreint l'exécution des fonctions sensibles et sécurise le search_path.

-- ============================================================
-- 1. SÉCURISATION DU CHAT (RLS)
-- ============================================================

-- Table chat_conversations
DROP POLICY IF EXISTS "permissive_conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "allow_all_authenticated_all_conversations" ON public.chat_conversations;

CREATE POLICY "Admins can manage all conversations"
ON public.chat_conversations FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Users can manage their own conversations"
ON public.chat_conversations FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Table chat_messages
DROP POLICY IF EXISTS "permissive_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "allow_all_authenticated_read_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "allow_all_authenticated_insert_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "allow_all_authenticated_delete_messages" ON public.chat_messages;

CREATE POLICY "Admins can manage all messages"
ON public.chat_messages FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Users can view their own conversation messages"
ON public.chat_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_conversations
    WHERE id = conversation_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert messages in their own conversations"
ON public.chat_messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_conversations
    WHERE id = conversation_id AND user_id = auth.uid()
  ) AND sender_id = auth.uid()
);

-- ============================================================
-- 2. SÉCURISATION DES TABLES D'IA ET HISTORIQUE (RLS)
-- ============================================================

-- Table documents (Knowledge Base)
DROP POLICY IF EXISTS "Authenticated users can read documents" ON public.documents;
CREATE POLICY "Authenticated users can read documents"
ON public.documents FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage documents"
ON public.documents FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Table n8n_chat_histories
DROP POLICY IF EXISTS "Admins can manage n8n histories" ON public.n8n_chat_histories;
CREATE POLICY "Admins can manage n8n histories"
ON public.n8n_chat_histories FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- ============================================================
-- 3. SÉCURISATION DES FONCTIONS (SEARCH_PATH & EXECUTION)
-- ============================================================

-- Fixer le search_path pour toutes les fonctions critiques (prévention SQL injection)
ALTER FUNCTION public.is_admin(uuid) SET search_path = public;
ALTER FUNCTION public.create_new_contract(numeric, boolean) SET search_path = public, extensions;
ALTER FUNCTION public.reinvest_from_profit(numeric, boolean) SET search_path = public, extensions;
ALTER FUNCTION public.request_deposit(numeric, text, text, text, text) SET search_path = public, extensions;
ALTER FUNCTION public.request_refund(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.user_withdraw(numeric, text, jsonb) SET search_path = public, extensions;
ALTER FUNCTION public.reconcile_profit_balances() SET search_path = public, extensions;
ALTER FUNCTION public.reject_deposit(uuid, text) SET search_path = public, extensions;
ALTER FUNCTION public.reject_deposits_in_bulk(uuid[], text) SET search_path = public, extensions;
ALTER FUNCTION public.reject_refund(uuid, text) SET search_path = public, extensions;
ALTER FUNCTION public.reject_withdrawal(uuid, text) SET search_path = public, extensions;
ALTER FUNCTION public.request_password_reset_otp(text) SET search_path = public, extensions;
ALTER FUNCTION public.request_withdrawal_otp(numeric, text, jsonb) SET search_path = public, extensions;
ALTER FUNCTION public.request_withdrawal_otp_impl(numeric, text, jsonb) SET search_path = public, extensions;
ALTER FUNCTION public.scheduled_notification_cleanup() SET search_path = public, extensions;
ALTER FUNCTION public.search_chat_messages(text, integer) SET search_path = public, extensions;
ALTER FUNCTION public.send_admin_broadcast(uuid[], text, text) SET search_path = public, extensions;
ALTER FUNCTION public.send_chat_message(uuid, text) SET search_path = public, extensions;
ALTER FUNCTION public.submit_support_request(text, text) SET search_path = public, extensions;
ALTER FUNCTION public.switch_to_conversation(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.sync_chat_unread_counts(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.transfer_profit_to_deposit(numeric) SET search_path = public, extensions;
ALTER FUNCTION public.trigger_chat_ai_response() SET search_path = public, extensions;
ALTER FUNCTION public.update_company_account_balances() SET search_path = public, extensions;
ALTER FUNCTION public.update_user_profile(text, text, text, text, text, text, text, date, text) SET search_path = public, extensions;
ALTER FUNCTION public.user_has_verified_2fa(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.verify_and_withdraw(uuid, text) SET search_path = public, extensions;
ALTER FUNCTION public.verify_backup_code(text) SET search_path = public, extensions;
ALTER FUNCTION public.verify_password_reset_otp_internal(text, text) SET search_path = public, extensions;

-- Restreindre l'exécution des fonctions administratives
REVOKE EXECUTE ON FUNCTION public.reconcile_profit_balances() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.reject_deposit(uuid, text) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.reject_deposits_in_bulk(uuid[], text) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.reject_refund(uuid, text) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.scheduled_notification_cleanup() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.send_admin_broadcast(uuid[], text, text) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.update_company_account_balances() FROM authenticated, anon, public;

-- Note: Les admins peuvent toujours les exécuter car ils sont superutilisateurs ou via SECURITY DEFINER si configuré avec précaution.
-- Pour Supabase, nous devons souvent accorder explicitement si nous voulons que le tableau de bord ou des scripts admin les utilisent.
