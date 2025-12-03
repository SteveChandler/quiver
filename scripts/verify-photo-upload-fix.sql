-- ================================================
-- VERIFICATION SCRIPT FOR PHOTO UPLOAD FIX
-- ================================================
-- Run this in Supabase SQL Editor to verify the fix
-- https://supabase.com/dashboard/project/vawdnbbgawichorsjiwe/editor

\echo '================================================'
\echo 'PHOTO UPLOAD FIX - VERIFICATION'
\echo '================================================'
\echo ''

\echo '✓ Checking if storage_usage table exists...'
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'storage_usage'
        ) THEN '✅ storage_usage table EXISTS'
        ELSE '❌ storage_usage table MISSING'
    END as status;

\echo ''
\echo '✓ Checking if update_user_storage_usage() function exists...'
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'update_user_storage_usage'
        ) THEN '✅ update_user_storage_usage() function EXISTS'
        ELSE '❌ update_user_storage_usage() function MISSING'
    END as status;

\echo ''
\echo '✓ Checking if get_user_storage_stats() function exists...'
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'get_user_storage_stats'
        ) THEN '✅ get_user_storage_stats() function EXISTS'
        ELSE '❌ get_user_storage_stats() function MISSING'
    END as status;

\echo ''
\echo '✓ Checking if trigger exists on session_media table...'
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgrelid = 'public.session_media'::regclass
            AND tgname = 'trigger_track_session_media_upload'
        ) THEN '✅ trigger_track_session_media_upload EXISTS'
        ELSE '❌ trigger_track_session_media_upload MISSING'
    END as status;

\echo ''
\echo '✓ Checking RLS policies on storage_usage table...'
SELECT
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ') as policies
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'storage_usage';

\echo ''
\echo '✓ Current state of storage and database...'
SELECT
    (SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'session-media') as files_in_storage,
    (SELECT COUNT(*) FROM session_media) as records_in_database,
    (SELECT COUNT(*) FROM storage_usage) as users_with_storage_tracking;

\echo ''
\echo '================================================'
\echo 'NEXT STEPS'
\echo '================================================'
\echo '1. All checks above should show ✅'
\echo '2. Go to https://dev.quiversurf.app'
\echo '3. Navigate to a session page'
\echo '4. Try uploading a photo'
\echo '5. Photo should appear on the session page'
\echo '================================================'
