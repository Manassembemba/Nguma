-- Migration de performance pour optimiser les IO Disque et l'efficacité des requêtes
-- 1. Indexation des clés étrangères manquantes (Performance Advisor)
-- 2. Optimisation des politiques RLS (Utilisation de SELECT auth.uid())
-- 3. Ajout d'index stratégiques sur les tables volumineuses

-- ==========================================
-- 1. AJOUT DES INDEX SUR LES CLÉS ÉTRANGÈRES MANQUANTES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_global_settings_updated_by ON public.global_settings (updated_by);
CREATE INDEX IF NOT EXISTS idx_payment_methods_category_id ON public.payment_methods (category_id);
CREATE INDEX IF NOT EXISTS idx_payment_method_fields_payment_method_id ON public.payment_method_fields (payment_method_id);
CREATE INDEX IF NOT EXISTS idx_transaction_metadata_transaction_id ON public.transaction_metadata (transaction_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON public.chat_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_message_id ON public.chat_attachments (message_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_debit_account ON public.accounting_entries (debit_account_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_credit_account ON public.accounting_entries (credit_account_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_user_id ON public.accounting_entries (related_user_id);

-- ==========================================
-- 2. OPTIMISATION DES POLITIQUES RLS
-- ==========================================
-- La recommandation Supabase pour éviter la réévaluation par ligne est d'utiliser (SELECT auth.uid())

-- TABLE: profiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((SELECT auth.uid()) = id);

-- TABLE: wallets
DROP POLICY IF EXISTS "Users can insert their own wallet" ON public.wallets;
CREATE POLICY "Users can insert their own wallet" ON public.wallets FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own wallet" ON public.wallets;
CREATE POLICY "Users can view their own wallet" ON public.wallets FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- TABLE: contracts
DROP POLICY IF EXISTS "Users can create contracts via RPC" ON public.contracts;
CREATE POLICY "Users can create contracts via RPC" ON public.contracts FOR INSERT WITH CHECK (((SELECT auth.uid()) IS NOT NULL) AND (user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can view their own contracts" ON public.contracts;
CREATE POLICY "Users can view their own contracts" ON public.contracts FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- TABLE: transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- TABLE: withdrawal_verifications
DROP POLICY IF EXISTS "Users can create own verifications" ON public.withdrawal_verifications;
CREATE POLICY "Users can create own verifications" ON public.withdrawal_verifications FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own verifications" ON public.withdrawal_verifications;
CREATE POLICY "Users can update own verifications" ON public.withdrawal_verifications FOR UPDATE USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own verifications" ON public.withdrawal_verifications;
CREATE POLICY "Users can view own verifications" ON public.withdrawal_verifications FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ==========================================
-- 3. NETTOYAGE DES LOGS ANCIENS (OPTIONNEL MAIS RECOMMANDÉ POUR L'IO)
-- ==========================================
-- Si vous avez beaucoup de logs de login ou de notifications anciennes, cela libère de l'espace et du budget IO
DELETE FROM public.login_audit WHERE created_at < now() - INTERVAL '30 days';
DELETE FROM public.notifications_queue WHERE processed_at < now() - INTERVAL '7 days' AND status = 'processed';

-- Ajout d'un index sur processed_at pour le nettoyage futur
CREATE INDEX IF NOT EXISTS idx_notifications_queue_processed_at ON public.notifications_queue (processed_at) WHERE status = 'processed';
