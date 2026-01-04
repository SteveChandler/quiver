-- Verification Script: Check Production Database Security Status
-- Run this in Supabase Dashboard > SQL Editor (Production)
-- 
-- PURPOSE: Verify if increment_session_share_count and set_updated_at
--          need search_path protection in production

-- ============================================================================
-- Check 1: Do these functions exist in production?
-- ============================================================================

SELECT 
  'Functions in Production' as check_type,
  COUNT(*) FILTER (WHERE proname = 'increment_session_share_count') as has_increment_function,
  COUNT(*) FILTER (WHERE proname = 'set_updated_at') as has_set_updated_at
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public';

-- ============================================================================
-- Check 2: Are they protected with search_path?
-- ============================================================================

SELECT 
  p.proname AS function_name,
  p.prosecdef AS is_security_definer,
  p.proconfig AS search_path_config,
  CASE 
    WHEN p.proconfig IS NOT NULL AND array_to_string(p.proconfig, ',') LIKE '%search_path%' 
    THEN '✅ PROTECTED'
    WHEN p.prosecdef = true AND (p.proconfig IS NULL OR NOT array_to_string(p.proconfig, ',') LIKE '%search_path%')
    THEN '❌ VULNERABLE - SECURITY DEFINER without search_path'
    ELSE '⚠️  No search_path (low risk if not SECURITY DEFINER)'
  END AS security_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('increment_session_share_count', 'set_updated_at')
ORDER BY p.proname;

-- ============================================================================
-- Check 3: Which migrations have been applied?
-- ============================================================================

SELECT 
  version,
  name
FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20251017025417',  -- Blanket search_path fix
  '20251031211518',  -- increment_session_share_count
  '20251224160000'   -- set_updated_at (forecast alerts)
)
ORDER BY version;

-- ============================================================================
-- INTERPRETATION:
-- ============================================================================
-- 
-- IF increment_session_share_count exists AND shows "❌ VULNERABLE":
--   → YES, apply the P0 security fix to production
--
-- IF set_updated_at exists AND shows "❌ VULNERABLE":
--   → YES, apply the P0 security fix to production
--
-- IF both show "✅ PROTECTED":
--   → Someone already fixed it, no action needed
--
-- IF functions don't exist:
--   → Migrations not yet applied to production, fix when they are
--
-- ============================================================================

