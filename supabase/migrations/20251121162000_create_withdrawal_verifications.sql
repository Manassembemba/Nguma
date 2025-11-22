-- Create table for withdrawal verification codes (OTP)
CREATE TABLE IF NOT EXISTS public.withdrawal_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    verification_code TEXT NOT NULL,
    amount NUMERIC(20,8) NOT NULL,
    method TEXT NOT NULL,
    payment_details TEXT NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '10 minutes'),
    CONSTRAINT valid_method CHECK (method IN ('crypto', 'mobile_money'))
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_withdrawal_verifications_user_id ON public.withdrawal_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_verifications_expires_at ON public.withdrawal_verifications(expires_at);

-- Enable RLS
ALTER TABLE public.withdrawal_verifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own verification codes
CREATE POLICY "Users can view own verifications"
    ON public.withdrawal_verifications
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own verification codes
CREATE POLICY "Users can create own verifications"
    ON public.withdrawal_verifications
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own verification codes (to mark as verified)
CREATE POLICY "Users can update own verifications"
    ON public.withdrawal_verifications
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Function to clean up expired verification codes (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_withdrawal_verifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.withdrawal_verifications
    WHERE expires_at < now();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.cleanup_expired_withdrawal_verifications() TO authenticated;

COMMENT ON TABLE public.withdrawal_verifications IS 'Stores OTP codes for withdrawal verification (MFA)';
COMMENT ON COLUMN public.withdrawal_verifications.verification_code IS '6-digit OTP code sent to user';
COMMENT ON COLUMN public.withdrawal_verifications.expires_at IS 'Code expires after 10 minutes';
