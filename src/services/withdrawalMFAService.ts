import { supabase } from "@/integrations/supabase/client";

/**
 * Request OTP code for withdrawal verification
 */
export const requestWithdrawalOTP = async (amount: number, method: string, details: Record<string, any>) => {
    // On ne loggue pas les détails du MFA en production pour plus de propreté et sécurité

    const { data, error } = await supabase.rpc('request_withdrawal_otp', {
        p_amount: amount,
        p_method: method,
        p_payment_details: details
    } as any);

    if (error) {
        console.error("[WithdrawalMFA] RPC request_withdrawal_otp error:", error);
        throw new Error(error.message);
    }
    
    const result = data as any;
    // Résultat du RPC traité silencieusement si succès

    
    if (result && !result.success) throw new Error(result.error);
    return result;
};

/**
 * Verify OTP code and process withdrawal
 */
export const verifyAndWithdraw = async (verificationId: string, otpCode: string) => {
    // Vérification OTP lancée

    const { data, error } = await supabase.rpc('verify_and_withdraw', {
        p_verification_id: verificationId,
        p_otp_code: otpCode
    } as any);

    if (error) {
        console.error("[WithdrawalMFA] RPC verify_and_withdraw error:", error);
        throw new Error(error.message);
    }
    
    const result = data as any;
    // Vérification terminée
    
    if (result && !result.success) {
        console.error("[WithdrawalMFA] Withdrawal failed business logic:", result.error);
        throw new Error(result.error);
    }
    return result;
};
