-- Add individual document status columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS kyc_id_front_status public.kyc_status DEFAULT 'not_submitted',
ADD COLUMN IF NOT EXISTS kyc_id_back_status public.kyc_status DEFAULT 'not_submitted',
ADD COLUMN IF NOT EXISTS kyc_residence_proof_status public.kyc_status DEFAULT 'not_submitted';

-- Initialize status for existing users
UPDATE public.profiles
SET 
    kyc_id_front_status = CASE 
        WHEN kyc_status = 'verified' THEN 'verified'::public.kyc_status
        WHEN kyc_status = 'rejected' THEN 'rejected'::public.kyc_status
        WHEN kyc_id_front_url IS NOT NULL THEN 'pending'::public.kyc_status
        ELSE 'not_submitted'::public.kyc_status
    END,
    kyc_id_back_status = CASE 
        WHEN kyc_status = 'verified' THEN 'verified'::public.kyc_status
        WHEN kyc_status = 'rejected' THEN 'rejected'::public.kyc_status
        WHEN kyc_id_back_url IS NOT NULL THEN 'pending'::public.kyc_status
        ELSE 'not_submitted'::public.kyc_status
    END,
    kyc_residence_proof_status = CASE 
        WHEN kyc_status = 'verified' THEN 'verified'::public.kyc_status
        WHEN kyc_status = 'rejected' THEN 'rejected'::public.kyc_status
        WHEN kyc_residence_proof_url IS NOT NULL THEN 'pending'::public.kyc_status
        ELSE 'not_submitted'::public.kyc_status
    END
WHERE kyc_status != 'not_submitted';
