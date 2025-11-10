-- 1. Add the contract_pdf_url column to the contracts table
ALTER TABLE public.contracts
ADD COLUMN contract_pdf_url TEXT;

-- 2. Create a private storage bucket for contracts
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', FALSE)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up Row Level Security policies for the contracts bucket

-- Helper function to check for admin role
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = is_admin.user_id
    AND user_roles.role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Allow admins to upload files
CREATE POLICY "Allow admin uploads"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'contracts' AND
  is_admin(auth.uid())
);

-- Allow authenticated users to view files
CREATE POLICY "Allow authenticated users to view files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'contracts' AND
  auth.role() = 'authenticated'
);

-- Allow admins to update files
CREATE POLICY "Allow admin updates"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'contracts' AND
  is_admin(auth.uid())
);

-- Allow admins to delete files
CREATE POLICY "Allow admin deletes"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'contracts' AND
  is_admin(auth.uid())
);