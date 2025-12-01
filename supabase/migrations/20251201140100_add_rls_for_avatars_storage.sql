-- Migration: Add RLS Policies for Avatars Storage Bucket
-- Description: Sets up security policies for the 'avatars' bucket, allowing users to manage their own avatar.

-- 1. Allow public read access for everyone
-- This policy allows anyone to download/view files from the 'avatars' bucket.
CREATE POLICY "Public Read Access for Avatars"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- 2. Allow authenticated users to insert their own avatar
-- This policy ensures a user can only upload a file into a folder that matches their own user_id.
-- Example path: /avatars/869e64e8-sc54-47d8-94b6-673b7a2d619e/avatar.png
CREATE POLICY "User Insert Access for Own Avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Allow authenticated users to update their own avatar
-- This policy allows a user to update/overwrite a file within their own folder.
CREATE POLICY "User Update Access for Own Avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Allow authenticated users to delete their own avatar
-- This policy allows a user to delete a file from their own folder.
CREATE POLICY "User Delete Access for Own Avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
