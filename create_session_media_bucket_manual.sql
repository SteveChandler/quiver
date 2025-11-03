-- Manual bucket creation for session-media
-- Run this in Supabase Dashboard SQL Editor: https://supabase.com/dashboard/project/vawdnbbgawichorsjiwe/sql

-- 1) Check if bucket already exists
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'session-media';

-- 2) Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'session-media',
  'session-media',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3) Verify bucket was created
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'session-media';

-- 4) Verify RLS policies exist
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND qual::text LIKE '%session-media%'
ORDER BY cmd, policyname;
