-- Migration de nettoyage et optimisation finale de la performance
-- 1. Suppression des index en doublon
-- 2. Optimisation des politiques RLS restantes (SELECT auth.uid())
-- 3. Nettoyage de la table de bloat net._http_response (si possible)

-- ==========================================
-- 1. SUPPRESSION DES INDEX EN DOUBLON
-- ==========================================
DROP INDEX IF EXISTS public.idx_accounting_entries_credit_account;
DROP INDEX IF EXISTS public.idx_accounting_entries_debit_account;
DROP INDEX IF EXISTS public.idx_accounting_entries_user_id;
DROP INDEX IF EXISTS public.idx_payment_method_fields_payment_method_id;
DROP INDEX IF EXISTS public.idx_transaction_metadata_transaction_id;

-- ==========================================
-- 2. OPTIMISATION RLS RESTANTE
-- ==========================================

-- TABLE: admin_actions
DROP POLICY IF EXISTS "Admins can create admin actions" ON public.admin_actions;
CREATE POLICY "Admins can create admin actions" ON public.admin_actions FOR INSERT WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

-- TABLE: backup_codes
DROP POLICY IF EXISTS "Users can insert their own backup codes" ON public.backup_codes;
CREATE POLICY "Users can insert their own backup codes" ON public.backup_codes FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- TABLE: login_audit
DROP POLICY IF EXISTS "Only authenticated users can insert own login audit" ON public.login_audit;
CREATE POLICY "Only authenticated users can insert own login audit" ON public.login_audit FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- TABLE: transaction_metadata
DROP POLICY IF EXISTS "Users can insert their transaction metadata" ON public.transaction_metadata;
CREATE POLICY "Users can insert their transaction metadata" ON public.transaction_metadata FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM transactions WHERE id = transaction_metadata.transaction_id AND user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can view their transaction metadata" ON public.transaction_metadata;
CREATE POLICY "Users can view their transaction metadata" ON public.transaction_metadata FOR SELECT USING (EXISTS (SELECT 1 FROM transactions WHERE id = transaction_metadata.transaction_id AND user_id = (SELECT auth.uid())));

-- TABLE: chat_conversations
DROP POLICY IF EXISTS "Users can create own conversation" ON public.chat_conversations;
CREATE POLICY "Users can create own conversation" ON public.chat_conversations FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own conversation" ON public.chat_conversations;
CREATE POLICY "Users can view own conversation" ON public.chat_conversations FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- TABLE: chat_messages
DROP POLICY IF EXISTS "Users can send messages in their conversation" ON public.chat_messages;
CREATE POLICY "Users can send messages in their conversation" ON public.chat_messages FOR INSERT WITH CHECK (((SELECT auth.uid()) = sender_id) AND (EXISTS (SELECT 1 FROM chat_conversations WHERE id = chat_messages.conversation_id AND (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'::app_role)))));

-- TABLE: user_notification_preferences
DROP POLICY IF EXISTS "Users can insert their own notification preferences." ON public.user_notification_preferences;
CREATE POLICY "Users can insert their own notification preferences." ON public.user_notification_preferences FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- TABLE: notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- TABLE: support_requests
DROP POLICY IF EXISTS "Users can insert their own support requests" ON public.support_requests;
CREATE POLICY "Users can insert their own support requests" ON public.support_requests FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own support requests" ON public.support_requests;
CREATE POLICY "Users can view their own support requests" ON public.support_requests FOR SELECT USING (user_id = (SELECT auth.uid()));

-- ==========================================
-- 3. MAINTENANCE EXTENSION NET (HTTP RESPONSES)
-- ==========================================
-- Nettoyage des anciennes réponses HTTP de pg_net pour réduire le bloat
DELETE FROM net._http_response WHERE created_at < now() - INTERVAL '1 day';
