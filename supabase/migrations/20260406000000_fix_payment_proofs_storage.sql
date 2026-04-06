-- Migration: Fix Payment Proofs & Withdrawal Proofs Storage Policies
-- Date: 2026-04-06
-- Description: Fix 400 error when users try to upload payment proofs.
-- Files are now stored in: bucket/userId/timestamp_random.ext

-- ============================================================
-- 1. ENSURE BUCKETS EXIST
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'payment_proofs',
    'payment_proofs',
    true,
    10485760, -- 10MB max
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'withdrawal-proofs',
    'withdrawal-proofs',
    true,
    10485760, -- 10MB max
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. DROP EXISTING CONFLICTING POLICIES
-- ============================================================
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload proofs" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to payment_proofs bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload to payment_proofs" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all payment proofs" ON storage.objects;

-- Drop withdrawal-proofs policies too
DROP POLICY IF EXISTS "Public can view withdrawal proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload withdrawal proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete withdrawal proofs" ON storage.objects;

-- ============================================================
-- 3. CREATE PROPER POLICIES FOR payment_proofs BUCKET
-- ============================================================

-- SELECT: Public can view (bucket is public)
CREATE POLICY "Anyone can view payment proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment_proofs');

-- INSERT: Authenticated users can upload to their own folder
CREATE POLICY "Users can upload payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'payment_proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: Users can update their own files
CREATE POLICY "Users can update their own payment proofs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'payment_proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: Users can delete their own files
CREATE POLICY "Users can delete their own payment proofs"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'payment_proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- 4. CREATE PROPER POLICIES FOR withdrawal-proofs BUCKET
-- ============================================================

-- SELECT: Public can view
CREATE POLICY "Anyone can view withdrawal proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'withdrawal-proofs');

-- INSERT: Authenticated users can upload to their own folder
CREATE POLICY "Users can upload withdrawal proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'withdrawal-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: Users can update their own files
CREATE POLICY "Users can update their own withdrawal proofs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'withdrawal-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: Users can delete their own files
CREATE POLICY "Users can delete their own withdrawal proofs"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'withdrawal-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- 5. ADD ADMIN POLICIES FOR BOTH BUCKETS
-- ============================================================
-- Admins can manage all files in payment_proofs
CREATE POLICY "Admins can manage all payment proofs"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'payment_proofs'
    AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Admins can manage all files in withdrawal-proofs
CREATE POLICY "Admins can manage all withdrawal proofs"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'withdrawal-proofs'
    AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- ============================================================
-- 6. DOCUMENTATION (skipped - requires storage.objects ownership)
-- ============================================================
-- Policies have been created successfully. Comments are omitted
-- because postgres role doesn't own storage.objects in Supabase.
