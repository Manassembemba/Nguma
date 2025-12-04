import { supabase } from "@/integrations/supabase/client";

/**
 * Request OTP code for withdrawal verification
 */
export const requestWithdrawalOTP = async (amount: number, method: string, details: Record<string, any>) => {
    const { data, error } = await supabase.rpc('request_withdrawal_otp', {
        amount: amount,
        method: method,
        payment_details: details
    } as any);

    if (error) throw new Error(error.message);
    const result = data as any;
    if (result && !result.success) throw new Error(result.error);
    return result;
};

/**
 * Verify OTP code and process withdrawal
 */
export const verifyAndWithdraw = async (verificationId: string, otpCode: string) => {
    const { data, error } = await supabase.rpc('verify_and_withdraw', {
        p_verification_id: verificationId,
        p_otp_code: otpCode
    } as any);

    if (error) throw new Error(error.message);
    const result = data as any;
    if (result && !result.success) throw new Error(result.error);
    return result;
};
