-- Migration: Fix Dormant Funds Reminders to use individual queue items
-- Date: 2026-01-09
-- Description: 
-- 1. Updates process_dormant_funds_reminders to insert individual rows in notifications_queue.
-- 2. Removes the 'dormant_funds_reminder_batch' concept.

CREATE OR REPLACE FUNCTION public.process_dormant_funds_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
    v_count INTEGER := 0;
    v_batch_size INTEGER := 50; -- Limit batch to avoid timeouts
    v_support_phone TEXT;
BEGIN
    -- Get support phone for emails
    SELECT value INTO v_support_phone FROM public.settings WHERE key = 'support_whatsapp_number' LIMIT 1;
    v_support_phone := COALESCE(v_support_phone, '+243...');

    -- Process users individually and insert into notifications_queue
    FOR v_user IN 
        SELECT p.id, p.email, p.first_name, p.last_name, w.total_balance
        FROM public.profiles p
        JOIN public.wallets w ON p.id = w.user_id
        WHERE w.total_balance >= 50
        AND (p.last_dormant_reminder_at IS NULL OR p.last_dormant_reminder_at < now() - INTERVAL '7 days')
        AND NOT EXISTS (
            SELECT 1 FROM public.contracts c 
            WHERE c.user_id = p.id AND c.created_at > now() - INTERVAL '1 month' -- Changed to 1 month for dormancy
        )
        LIMIT v_batch_size
    LOOP
        -- Enqueue individual notification
        INSERT INTO public.notifications_queue (
            template_id, 
            recipient_user_id, 
            recipient_email, 
            notification_params
        )
        VALUES (
            'dormant_funds_reminder',
            v_user.id,
            v_user.email,
            jsonb_build_object(
                'name', COALESCE(v_user.first_name || ' ' || v_user.last_name, 'Investisseur'),
                'amount', v_user.total_balance,
                'support_phone', v_support_phone
            )
        );

        -- Update timestamp
        UPDATE public.profiles 
        SET last_dormant_reminder_at = now() 
        WHERE id = v_user.id;

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'processed_count', v_count);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
