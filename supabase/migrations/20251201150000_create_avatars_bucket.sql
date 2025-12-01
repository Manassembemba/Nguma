-- Migration to create the 'avatars' bucket and set its policies.

-- 1. Create the bucket by inserting into storage.buckets if it doesn't exist.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'avatars', 'avatars', true, 5242880, '{"image/png", "image/jpeg", "image/webp", "image/jpg"}'
ON CONFLICT (id) DO NOTHING;

-- Grant usage on the storage schema to the postgres user
-- This is necessary to allow the postgres user to set the role to storage_admin
-- Note: In a production environment, you might want more restrictive grants.
DO
$$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'supabase_storage_admin'
  )
  THEN
    CREATE ROLE supabase_storage_admin;
  END IF;
  GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated;
  GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, anon, authenticated;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO postgres, anon, authenticated;
  -- Alter the owner of the objects to supabase_storage_admin if it is not already
  -- This step may not be necessary if the ownership is already correct
  -- ALTER TABLE storage.objects OWNER TO supabase_storage_admin;
  -- ALTER TABLE storage.buckets OWNER TO supabase_storage_admin;
END
$$;


-- 2. Temporarily switch to the superuser role to manage policies
-- Use a DO block to handle role switching securely
DO
$$
BEGIN
  -- Check if the current user is a superuser or has the necessary privileges
  -- If not, this block will fail, which is safer than proceeding.
  SET LOCAL ROLE postgres; 

  -- Temporarily switch to the storage_admin role
  SET LOCAL ROLE supabase_storage_admin;

  -- 3. Enable RLS for storage.objects if not already enabled
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

  -- 4. Drop existing policies for the 'avatars' bucket to ensure a clean slate
  DROP POLICY IF EXISTS "Public read access for avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated user can upload own avatar" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated user can update own avatar" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated user can delete own avatar" ON storage.objects;

  -- 5. RLS Policy: Allow public read access to everyone for the 'avatars' bucket.
  CREATE POLICY "Public read access for avatars"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'avatars' );

  -- 6. RLS Policy: Allow authenticated users to upload their own avatar.
  CREATE POLICY "Authenticated user can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

  -- 7. RLS Policy: Allow authenticated users to update their own avatar.
  CREATE POLICY "Authenticated user can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

  -- 8. RLS Policy: Allow authenticated users to delete their own avatar.
  CREATE POLICY "Authenticated user can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

  -- The role is automatically reset at the end of the DO block
END
$$;
