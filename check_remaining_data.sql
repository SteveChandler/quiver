-- Check for remaining user data across all tables
-- Run this in your Supabase dashboard SQL editor

-- First, check basic user counts
SELECT 'auth.users' as table_name, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'public.profiles' as table_name, COUNT(*) as count FROM public.profiles
UNION ALL
SELECT 'public.sessions' as table_name, COUNT(DISTINCT user_id) as unique_users FROM public.sessions WHERE user_id IS NOT NULL
UNION ALL
SELECT 'public.boards' as table_name, COUNT(DISTINCT user_id) as unique_users FROM public.boards WHERE user_id IS NOT NULL
UNION ALL
SELECT 'public.beach_reviews' as table_name, COUNT(DISTINCT user_id) as unique_users FROM public.beach_reviews WHERE user_id IS NOT NULL;

-- Find all unique user IDs across tables to see what users still exist in data
SELECT DISTINCT user_id as remaining_user_id 
FROM (
    SELECT user_id FROM public.sessions WHERE user_id IS NOT NULL
    UNION 
    SELECT user_id FROM public.boards WHERE user_id IS NOT NULL
    UNION
    SELECT user_id FROM public.beach_reviews WHERE user_id IS NOT NULL
    UNION
    SELECT id as user_id FROM public.profiles WHERE id IS NOT NULL
) all_users
ORDER BY remaining_user_id;

-- Check if any auth.users still exist and their details
SELECT id, email, created_at, last_sign_in_at 
FROM auth.users 
ORDER BY created_at DESC;

-- Check profiles that might still exist
SELECT id, email, full_name, created_at 
FROM public.profiles 
ORDER BY created_at DESC;