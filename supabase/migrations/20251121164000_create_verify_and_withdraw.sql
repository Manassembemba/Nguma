-- Function to verify OTP and process withdrawal
CREATE OR REPLACE FUNCTION public.verify_and_withdraw(
    p_verification_id UUID,
    p_otp_code TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    verification_record record;
    withdrawal_result json;
BEGIN
    -- Check if user is authenticated
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated.');
    END IF;

    -- Get verification record
    SELECT * INTO verification_record
    FROM public.withdrawal_verifications
    WHERE id = p_verification_id
    AND user_id = v_user_id
    AND verified = FALSE
    AND expires_at > now();

    -- Check if verification exists and is valid
    IF verification_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Code de vérification invalide ou expiré.');
    END IF;

    -- Verify OTP code
    IF verification_record.verification_code != p_otp_code THEN
        RETURN json_build_object('success', false, 'error', 'Code de vérification incorrect.');
    END IF;

    -- Mark verification as used
    UPDATE public.withdrawal_verifications
    SET verified = TRUE
    WHERE id = p_verification_id;

    -- Process the withdrawal using the existing user_withdraw function
    SELECT public.user_withdraw(
        verification_record.amount,
        verification_record.method,
        CASE WHEN verification_record.method = 'crypto' THEN verification_record.payment_details ELSE NULL END,
        CASE WHEN verification_record.method = 'mobile_money' THEN verification_record.payment_details ELSE NULL END
    ) INTO withdrawal_result;

    -- Clean up old verification codes
    PERFORM public.cleanup_expired_withdrawal_verifications();

    RETURN withdrawal_result;

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_and_withdraw(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.verify_and_withdraw IS 'Verifies OTP code and processes withdrawal if valid';
