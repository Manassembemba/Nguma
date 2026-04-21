-- 1. Index pour optimiser la recherche de doublons et le traitement de la file
CREATE INDEX IF NOT EXISTS idx_notifications_queue_duplicates_check 
ON public.notifications_queue (recipient_email, template_id, status, created_at DESC);

-- 2. Trigger pour empêcher les doublons au niveau de la table (Idempotence)
-- Cela bloque les insertions identiques (même email, même template, mêmes paramètres) 
-- si elles surviennent dans un intervalle de 10 secondes.
CREATE OR REPLACE FUNCTION public.prevent_duplicate_notifications()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.notifications_queue 
        WHERE recipient_email = NEW.recipient_email 
        AND template_id = NEW.template_id 
        AND (notification_params @> NEW.notification_params OR NEW.notification_params @> notification_params)
        AND status = 'pending'
        AND created_at > NOW() - INTERVAL '10 seconds'
    ) THEN
        -- On annule l'insertion silencieusement pour éviter les emails en double
        RETURN NULL; 
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_duplicate_notifications ON public.notifications_queue;
CREATE TRIGGER trigger_prevent_duplicate_notifications
BEFORE INSERT ON public.notifications_queue
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_notifications();

-- 3. Fonction robuste pour récupérer et verrouiller les jobs (Atomic Fetch & Lock)
-- Utilise "FOR UPDATE SKIP LOCKED" pour gérer parfaitement la concurrence entre les instances du Cron.
CREATE OR REPLACE FUNCTION public.fetch_and_lock_notifications(p_batch_size INT)
RETURNS TABLE (
    id BIGINT,
    template_id TEXT,
    recipient_email TEXT,
    notification_params JSONB,
    retry_attempts INT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH selected_jobs AS (
        SELECT n.id
        FROM public.notifications_queue n
        WHERE n.status = 'pending'
        ORDER BY n.created_at ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.notifications_queue
    SET 
        status = 'processing',
        processed_at = NOW()
    FROM selected_jobs
    WHERE public.notifications_queue.id = selected_jobs.id
    RETURNING 
        public.notifications_queue.id,
        public.notifications_queue.template_id,
        public.notifications_queue.recipient_email,
        public.notifications_queue.notification_params,
        public.notifications_queue.retry_attempts;
END;
$$;
