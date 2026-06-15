CREATE OR REPLACE FUNCTION public.admin_review_kyc_document(
    p_user_id uuid, 
    p_document_type text, 
    p_status text, 
    p_reason text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_admin_id UUID := auth.uid();
    v_profile RECORD;
    v_new_status public.kyc_status;
BEGIN
    -- Check if caller is admin
    IF NOT public.is_admin(v_admin_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Accès refusé.');
    END IF;

    IF p_status NOT IN ('verified', 'rejected') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Statut invalide.');
    END IF;

    v_new_status := p_status::public.kyc_status;

    -- Update the specific document status
    CASE p_document_type
        WHEN 'id_front' THEN
            UPDATE public.profiles SET kyc_id_front_status = v_new_status WHERE id = p_user_id;
        WHEN 'id_back' THEN
            UPDATE public.profiles SET kyc_id_back_status = v_new_status WHERE id = p_user_id;
        WHEN 'residence_proof' THEN
            UPDATE public.profiles SET kyc_residence_proof_status = v_new_status WHERE id = p_user_id;
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'Type de document invalide.');
    END CASE;

    -- Fetch updated profile to check all statuses
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;

    -- Logical check for global status
    -- If any is rejected, global is rejected
    IF v_profile.kyc_id_front_status = 'rejected' OR 
       v_profile.kyc_id_back_status = 'rejected' OR 
       v_profile.kyc_residence_proof_status = 'rejected' THEN
        
        UPDATE public.profiles 
        SET kyc_status = 'rejected'::public.kyc_status,
            kyc_rejection_reason = COALESCE(p_reason, kyc_rejection_reason)
        WHERE id = p_user_id;
        
        -- Notification for rejection
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES ('kyc_rejected', v_profile.id, v_profile.email, jsonb_build_object('name', v_profile.first_name, 'reason', COALESCE(p_reason, 'Un de vos documents a été rejeté.')));

    -- If all required are verified, global is verified
    ELSIF v_profile.kyc_id_front_status = 'verified' AND 
          v_profile.kyc_id_back_status = 'verified' AND 
          v_profile.kyc_residence_proof_status = 'verified' THEN
          
        UPDATE public.profiles 
        SET kyc_status = 'verified'::public.kyc_status,
            kyc_rejection_reason = NULL
        WHERE id = p_user_id;

        -- Notification for approval
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES ('kyc_approved', v_profile.id, v_profile.email, jsonb_build_object('name', v_profile.first_name));
    
    -- Otherwise, it remains pending (or becomes pending if it was rejected/verified before)
    ELSE
        UPDATE public.profiles SET kyc_status = 'pending'::public.kyc_status WHERE id = p_user_id;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$function$;
