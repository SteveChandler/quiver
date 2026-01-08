-- Validation Query: Check Database Function Search Path Security
-- Run this after applying migration 20260104000000_fix_recent_function_search_paths.sql
-- 
-- PURPOSE: Verify all custom functions have proper search_path protection
-- against search path injection attacks.
--
-- HOW TO RUN:
-- Via Supabase Dashboard: Copy/paste into SQL Editor and run
-- Via psql: psql <connection-string> -f validate_search_path_security.sql
-- Via Supabase CLI: cat validate_search_path_security.sql | supabase db execute

-- ============================================================================
-- Check 1: List all custom functions with their security settings
-- ============================================================================

SELECT 
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS is_security_definer,
  p.proconfig AS search_path_config,
  CASE 
    WHEN p.proconfig IS NOT NULL AND array_to_string(p.proconfig, ',') LIKE '%search_path%' 
    THEN '✅ Protected'
    WHEN p.prosecdef = true AND (p.proconfig IS NULL OR NOT array_to_string(p.proconfig, ',') LIKE '%search_path%')
    THEN '⚠️  SECURITY DEFINER without search_path'
    ELSE '⚠️  No explicit search_path'
  END AS security_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname NOT LIKE 'pg_%'
  AND p.proname NOT LIKE '_temp_%'
ORDER BY 
  CASE 
    WHEN p.proconfig IS NOT NULL AND array_to_string(p.proconfig, ',') LIKE '%search_path%' THEN 1
    ELSE 2
  END,
  p.proname;

-- ============================================================================
-- Check 2: Specifically verify the two functions we fixed
-- ============================================================================

DO $$
DECLARE
  increment_protected BOOLEAN;
  set_updated_at_protected BOOLEAN;
BEGIN
  -- Check increment_session_share_count
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'increment_session_share_count'
      AND p.prosecdef = true
      AND p.proconfig IS NOT NULL
      AND array_to_string(p.proconfig, ',') LIKE '%search_path%'
  ) INTO increment_protected;

  -- Check set_updated_at
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'set_updated_at'
      AND p.prosecdef = true
      AND p.proconfig IS NOT NULL
      AND array_to_string(p.proconfig, ',') LIKE '%search_path%'
  ) INTO set_updated_at_protected;

  -- Report results
  RAISE NOTICE '================================================================================';
  RAISE NOTICE 'SECURITY VALIDATION RESULTS';
  RAISE NOTICE '================================================================================';
  
  IF increment_protected THEN
    RAISE NOTICE '✅ increment_session_share_count: PROTECTED';
  ELSE
    RAISE WARNING '❌ increment_session_share_count: NOT PROTECTED';
  END IF;

  IF set_updated_at_protected THEN
    RAISE NOTICE '✅ set_updated_at: PROTECTED';
  ELSE
    RAISE WARNING '❌ set_updated_at: NOT PROTECTED';
  END IF;

  IF increment_protected AND set_updated_at_protected THEN
    RAISE NOTICE '================================================================================';
    RAISE NOTICE '✅ ALL P0 SECURITY FIXES APPLIED SUCCESSFULLY';
    RAISE NOTICE '================================================================================';
  ELSE
    RAISE WARNING '================================================================================';
    RAISE WARNING '⚠️  SOME FUNCTIONS STILL NEED PROTECTION - Reapply migration';
    RAISE WARNING '================================================================================';
  END IF;
END $$;

-- ============================================================================
-- Check 3: Count functions by security status
-- ============================================================================

SELECT 
  COUNT(*) FILTER (WHERE p.proconfig IS NOT NULL AND array_to_string(p.proconfig, ',') LIKE '%search_path%') AS protected_functions,
  COUNT(*) FILTER (WHERE p.prosecdef = true AND (p.proconfig IS NULL OR NOT array_to_string(p.proconfig, ',') LIKE '%search_path%')) AS vulnerable_security_definer,
  COUNT(*) FILTER (WHERE p.prosecdef = false AND (p.proconfig IS NULL OR NOT array_to_string(p.proconfig, ',') LIKE '%search_path%')) AS unprotected_regular,
  COUNT(*) AS total_functions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname NOT LIKE 'pg_%'
  AND p.proname NOT LIKE '_temp_%';

-- ============================================================================
-- EXPECTED RESULTS:
-- ============================================================================
-- After successful migration:
-- - increment_session_share_count: ✅ Protected
-- - set_updated_at: ✅ Protected
-- - All or most functions should show "✅ Protected" status
-- - vulnerable_security_definer count should be 0
-- ============================================================================





