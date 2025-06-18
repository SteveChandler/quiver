-- Test script to verify beach reviews fix
-- Run this after applying the manual-beach-reviews-fix.sql

-- Test 1: Check if profiles table exists and has data
SELECT 
  'Profiles table check' as test,
  COUNT(*) as profile_count,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status
FROM profiles;

-- Test 2: Check foreign key relationship
SELECT 
  'Foreign key check' as test,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  CASE 
    WHEN ccu.table_name = 'profiles' THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'beach_reviews'
  AND kcu.column_name = 'user_id';

-- Test 3: Test beach reviews query with profiles join
SELECT 
  'Beach reviews query test' as test,
  COUNT(*) as review_count,
  '✅ JOIN WORKS' as status
FROM beach_reviews br
JOIN profiles p ON br.user_id = p.id
LIMIT 1;

-- Test 4: Check RLS policies
SELECT 
  'RLS policies check' as test,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) >= 3 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status
FROM pg_policies 
WHERE tablename = 'profiles';

-- Summary
SELECT '=== BEACH REVIEWS FIX VERIFICATION COMPLETE ===' as summary; 