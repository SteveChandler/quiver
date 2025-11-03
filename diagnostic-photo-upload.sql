-- ================================================
-- DIAGNOSTIC QUERIES FOR PHOTO UPLOAD ISSUE
-- ================================================
-- Problem: Photos uploaded on dev.quiversurf.app don't appear on session pages
-- Test Session ID: aea73ffd-5e2a-4b26-b506-fd9d81a1ca81
--
-- Run with: npx supabase db exec --file diagnostic-photo-upload.sql --project-ref <project-ref>
-- ================================================

\echo '================================================'
\echo 'PHOTO UPLOAD DIAGNOSTICS'
\echo '================================================'
\echo ''

-- ================================================
-- 1. CHECK TEST SESSION
-- ================================================
\echo '1. Checking if test session exists...'
SELECT
    id,
    user_id,
    beach_name,
    created_at,
    is_public
FROM sessions
WHERE id = 'aea73ffd-5e2a-4b26-b506-fd9d81a1ca81';

\echo ''
\echo '================================================'
\echo '2. CHECK SESSION_MEDIA TABLE'
\echo '================================================'
\echo '2a. Session media record count:'
SELECT COUNT(*) as total_records FROM session_media;

\echo ''
\echo '2b. Session media for test session:'
SELECT * FROM session_media
WHERE session_id = 'aea73ffd-5e2a-4b26-b506-fd9d81a1ca81';

\echo ''
\echo '2c. All session media records (if any):'
SELECT
    id,
    session_id,
    user_id,
    media_type,
    file_size,
    created_at
FROM session_media
ORDER BY created_at DESC
LIMIT 10;

\echo ''
\echo '================================================'
\echo '3. CHECK STORAGE.OBJECTS (FILES IN BUCKET)'
\echo '================================================'
\echo '3a. Files in session-media bucket:'
SELECT
    id,
    name,
    bucket_id,
    owner,
    created_at,
    (metadata->>'size')::bigint as file_size_bytes
FROM storage.objects
WHERE bucket_id = 'session-media'
ORDER BY created_at DESC
LIMIT 20;

\echo ''
\echo '3b. Total files in session-media bucket:'
SELECT COUNT(*) as total_files FROM storage.objects
WHERE bucket_id = 'session-media';

\echo ''
\echo '================================================'
\echo '4. CHECK STORAGE_USAGE TABLE'
\echo '================================================'
\echo '4a. Does storage_usage table exist?'
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'storage_usage'
) as storage_usage_exists;

\echo ''
\echo '4b. Storage usage records (if table exists):'
SELECT
    user_id,
    total_bytes,
    image_count,
    last_updated
FROM storage_usage
ORDER BY last_updated DESC
LIMIT 10;

\echo ''
\echo '================================================'
\echo '5. CHECK update_user_storage_usage() FUNCTION'
\echo '================================================'
\echo '5a. Does update_user_storage_usage function exist?'
SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'update_user_storage_usage'
) as function_exists;

\echo ''
\echo '5b. Function signature (if exists):'
SELECT
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'update_user_storage_usage';

\echo ''
\echo '================================================'
\echo '6. CHECK STORAGE BUCKET CONFIGURATION'
\echo '================================================'
\echo '6a. session-media bucket configuration:'
SELECT
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types,
    created_at
FROM storage.buckets
WHERE id = 'session-media';

\echo ''
\echo '6b. All storage buckets:'
SELECT id, name, public, file_size_limit FROM storage.buckets;

\echo ''
\echo '================================================'
\echo '7. CHECK STORAGE BUCKET RLS POLICIES'
\echo '================================================'
\echo '7a. Storage bucket policies:'
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND (
    policyname ILIKE '%session%media%'
    OR policyname ILIKE '%session-media%'
)
ORDER BY policyname;

\echo ''
\echo '7b. All storage.objects policies:'
SELECT
    policyname,
    cmd as operation,
    CASE
        WHEN cmd = 'INSERT' THEN 'Upload'
        WHEN cmd = 'SELECT' THEN 'Read'
        WHEN cmd = 'UPDATE' THEN 'Update'
        WHEN cmd = 'DELETE' THEN 'Delete'
        ELSE cmd
    END as action_type
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
ORDER BY cmd, policyname;

\echo ''
\echo '================================================'
\echo '8. CHECK SESSION_MEDIA TABLE RLS POLICIES'
\echo '================================================'
\echo '8a. session_media RLS policies:'
SELECT
    policyname,
    cmd as operation,
    CASE
        WHEN permissive = 'PERMISSIVE' THEN 'Permissive'
        ELSE 'Restrictive'
    END as type
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'session_media'
ORDER BY cmd, policyname;

\echo ''
\echo '================================================'
\echo '9. CHECK MIGRATION HISTORY'
\echo '================================================'
\echo '9a. Recent migrations related to session_media or storage:'
SELECT
    version,
    name,
    executed_at
FROM supabase_migrations.schema_migrations
WHERE name ILIKE '%session%media%'
   OR name ILIKE '%storage%'
   OR name ILIKE '%bucket%'
ORDER BY executed_at DESC
LIMIT 15;

\echo ''
\echo '================================================'
\echo '10. CHECK FOR TRIGGERS ON SESSION_MEDIA'
\echo '================================================'
\echo '10a. Triggers on session_media table:'
SELECT
    tgname as trigger_name,
    tgenabled as enabled,
    pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgrelid = 'public.session_media'::regclass
AND tgisinternal = false;

\echo ''
\echo '================================================'
\echo 'DIAGNOSTIC SUMMARY'
\echo '================================================'
\echo ''
\echo 'Check the output above for:'
\echo '  • Missing storage_usage table (Section 4)'
\echo '  • Missing update_user_storage_usage() function (Section 5)'
\echo '  • Files in storage.objects but not in session_media (Sections 2 & 3)'
\echo '  • Missing or incorrect storage bucket policies (Section 7)'
\echo '  • RLS policy issues on session_media table (Section 8)'
\echo ''
\echo 'If files exist in storage.objects but NOT in session_media:'
\echo '  → Upload succeeded but database insert failed'
\echo ''
\echo 'If NO files in storage.objects:'
\echo '  → Upload failed (likely storage_usage check or bucket policy issue)'
\echo ''
\echo '================================================'
