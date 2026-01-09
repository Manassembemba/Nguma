-- Migration: Disable New User Admin Notification
-- Date: 2026-01-09
-- Description: Supprime l'envoi d'email automatique aux admins lors de l'inscription d'un nouvel utilisateur.

-- 1. Mise à jour du trigger handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_first_name TEXT;
    v_last_name TEXT;
    v_full_name TEXT;
    v_avatar_url TEXT;
    v_meta JSONB;
BEGIN
    v_meta := NEW.raw_user_meta_data;

    -- 1. Stratégie de récupération du Prénom / Nom
    v_first_name := COALESCE(v_meta->>'first_name', '');
    v_last_name := COALESCE(v_meta->>'last_name', '');

    IF v_first_name = '' AND v_last_name = '' THEN
        v_full_name := COALESCE(v_meta->>'full_name', v_meta->>'name', '');
        
        IF v_full_name != '' THEN
            IF position(' ' in v_full_name) > 0 THEN
                v_first_name := split_part(v_full_name, ' ', 1);
                v_last_name := substring(v_full_name from position(' ' in v_full_name) + 1);
            ELSE
                v_first_name := v_full_name;
                v_last_name := '';
            END IF;
        END IF;
    END IF;

    -- 2. Récupération de l'avatar
    v_avatar_url := COALESCE(v_meta->>'avatar_url', v_meta->>'picture', '');

    -- 3. Insertion du profil
    INSERT INTO public.profiles (id, email, first_name, last_name, post_nom, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        v_first_name,
        v_last_name,
        COALESCE(v_meta->>'post_nom', ''),
        v_avatar_url
    );

    -- 4. Insertion du portefeuille
    INSERT INTO public.wallets (user_id)
    VALUES (NEW.id);

    -- 5. Assignation du rôle par défaut
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'investor');

    -- [REMOVED] Enqueue admin notification for new user registration

    RETURN NEW;
END;
$$;

-- 2. Mise à jour de la RPC enqueue_email_notification
CREATE OR REPLACE FUNCTION public.enqueue_email_notification(
    p_template_id TEXT,
    p_params JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_recipient_email TEXT;
    v_recipient_user_id UUID;
    v_name TEXT;
    v_admin_emails JSONB;
    admin_record RECORD;
BEGIN
    IF v_user_id IS NULL AND NOT p_params ? 'to' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'User not authenticated and no recipient specified in params.');
    END IF;

    -- Déterminer le destinataire principal (utilisateur ou admin en boucle)
    IF p_template_id LIKE '%_admin' OR p_template_id IN ('new_deposit_request', 'new_withdrawal_request', 'new_refund_request') THEN
        -- Définir le type de notification pour le filtrage
        DECLARE
            v_notif_type TEXT := CASE 
                WHEN p_template_id = 'new_deposit_request' THEN 'admin_deposit'
                WHEN p_template_id = 'new_withdrawal_request' THEN 'admin_withdrawal'
                WHEN p_template_id = 'new_contract_admin' THEN 'admin_contract'
                WHEN p_template_id = 'new_support_request_admin' THEN 'admin_support'
                WHEN p_template_id = 'new_refund_request' THEN 'admin_refund'
                ELSE 'system'
            END;
        BEGIN
            -- Si c'est un template admin, on boucle sur tous les admins
            FOR admin_record IN
                SELECT u.id, u.email 
                FROM auth.users u
                JOIN public.user_roles ur ON u.id = ur.user_id
                LEFT JOIN public.user_notification_preferences unp 
                    ON u.id = unp.user_id AND unp.notification_type::text = v_notif_type
                WHERE ur.role = 'admin'
                AND COALESCE(unp.email_enabled, TRUE) = TRUE
            LOOP
                INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
                VALUES (
                    p_template_id,
                    admin_record.id,
                    admin_record.email,
                    p_params
                );
            END LOOP;
        END;
        RETURN jsonb_build_object('success', TRUE, 'message', 'Admin notifications enqueued (filtered by individual preferences).');
    ELSE
        -- Pour les notifications utilisateur, le user_id est l'utilisateur courant
        v_recipient_user_id := v_user_id;

        IF p_params ? 'to' AND jsonb_typeof(p_params->'to') = 'string' THEN
            v_recipient_email := p_params->>'to';
            IF p_params ? 'userId' AND jsonb_typeof(p_params->'userId') = 'string' THEN
                BEGIN
                    v_recipient_user_id := (p_params->>'userId')::UUID;
                EXCEPTION WHEN invalid_text_representation THEN
                    RAISE WARNING 'Invalid UUID format for userId in params: %', p_params->>'userId';
                END;
            END IF;
        ELSE
            SELECT email INTO v_recipient_email FROM auth.users WHERE id = v_user_id;
            IF v_recipient_email IS NULL THEN
                RETURN jsonb_build_object('success', FALSE, 'error', 'Recipient email not found.');
            END IF;
        END IF;

        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            p_template_id,
            v_recipient_user_id,
            v_recipient_email,
            p_params
        );
        RETURN jsonb_build_object('success', TRUE, 'message', 'User notification enqueued.');
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;
