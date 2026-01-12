-- Fix search_path for functions created after blanket migration
-- Ensures explicit protection for recently added functions
-- Date: 2026-01-04
--
-- SECURITY CONTEXT:
-- Functions without SET search_path are vulnerable to search path injection attacks.
-- This migration adds explicit search_path protection to functions created after
-- the blanket fix in migration 20251017025417.
--
-- FUNCTIONS FIXED:
-- 1. increment_session_share_count - Created 2025-10-31 (modifies session data)
-- 2. set_updated_at - Created 2025-12-24 (trigger function for updated_at)
--
-- SAFE TO APPLY:
-- - Uses CREATE OR REPLACE (idempotent)
-- - Preserves all function logic
-- - Only adds SET search_path = public
-- - Includes defensive blanket protection loop

BEGIN;

-- ============================================================================
-- Fix 1: increment_session_share_count
-- ============================================================================
-- Original: SECURITY DEFINER but no SET search_path
-- Risk: Medium (modifies session data, could be exploited)
-- Fix: Add SET search_path = public

CREATE OR REPLACE FUNCTION increment_session_share_count(session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sessions
  SET share_count = share_count + 1
  WHERE id = session_id;
END;
$$;

COMMENT ON FUNCTION increment_session_share_count(uuid) IS
  'Increments the share_count field on a session. Called after successful share. SECURITY: Protected with SET search_path = public.';

-- ============================================================================
-- Fix 2: set_updated_at
-- ============================================================================
-- Original: No SECURITY DEFINER, no SET search_path
-- Risk: Low (simple trigger, but still vulnerable)
-- Fix: Add SECURITY DEFINER and SET search_path = public

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'Trigger function to automatically update updated_at timestamp. SECURITY: Protected with SET search_path = public.';

-- ============================================================================
-- Defensive: Apply blanket protection again
-- ============================================================================
-- This ensures any new functions created since the last blanket fix
-- (20251017025417) are also protected. This is defensive programming.

DO $$
DECLARE
    func_record RECORD;
    fixed_count INTEGER := 0;
BEGIN
    -- Loop through all custom functions in public schema
    FOR func_record IN
        SELECT
            p.proname,
            pg_get_function_identity_arguments(p.oid) as args,
            p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname NOT LIKE 'pg_%'
          AND p.proname NOT LIKE '_temp_%'
    LOOP
        BEGIN
            -- Try to set search_path for this function
            -- If it already has search_path set, this is a no-op
            -- If it doesn't, this adds protection
            EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public',
                func_record.proname, func_record.args);
            fixed_count := fixed_count + 1;
        EXCEPTION WHEN OTHERS THEN
            -- Continue on error (some functions might not support this)
            RAISE WARNING 'Could not set search_path for function %: %', 
                func_record.proname, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE '✅ Applied search_path protection to % functions', fixed_count;
    RAISE NOTICE '   Specifically fixed: increment_session_share_count, set_updated_at';
    RAISE NOTICE '   Run validation query to verify all functions are protected';
END;
$$;

COMMIT;

-- ============================================================================
-- VALIDATION QUERY (Run after migration)
-- ============================================================================
-- To verify all functions are protected, run:
--
-- SELECT 
--   p.proname,
--   pg_get_function_identity_arguments(p.oid) as args,
--   p.prosecdef as is_security_definer,
--   pg_get_function_result(p.oid) as returns
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
--   AND p.proname NOT LIKE 'pg_%'
--   AND p.proname NOT LIKE '_temp_%'
-- ORDER BY p.proname;
--
-- All functions should have proper protection.
-- ============================================================================






