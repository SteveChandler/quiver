-- Check user count and sample data after the migration disaster
BEGIN;

-- Check auth users count
SELECT 'AUTH USERS COUNT' as check_type, COUNT(*) as count 
FROM auth.users;

-- Check profiles count
SELECT 'PROFILES COUNT' as check_type, COUNT(*) as count 
FROM public.profiles;

-- Get sample of remaining auth users
SELECT 'SAMPLE AUTH USERS' as check_type, email, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 10;

-- Get sample of remaining profiles
SELECT 'SAMPLE PROFILES' as check_type, id, username, display_name, created_at 
FROM public.profiles 
ORDER BY created_at DESC 
LIMIT 10;

-- Check migration history
SELECT 'MIGRATION STATUS' as check_type, version, name, executed_at 
FROM supabase_migrations.schema_migrations 
WHERE version LIKE '202508260%' 
ORDER BY version;

ROLLBACK;