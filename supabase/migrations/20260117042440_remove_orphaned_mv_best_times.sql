-- ============================================================================
-- Migration: Remove Orphaned mv_best_times Resources
-- ============================================================================
-- Date: 2026-01-17
-- Purpose: Clean up orphaned materialized view, refresh function, and cron job
--          that were left behind after mv_beach_hourly_scores removal
--
-- CONTEXT:
-- - mv_beach_hourly_scores was removed in migration 20260113120100
-- - mv_best_times depended on v_beach_hourly_scores (now removed)
-- - refresh_mv_best_times() function still exists but references non-existent MV
-- - Cron job may still be scheduled, wasting compute hourly
--
-- CLEANUP:
-- 1. Unschedule the hourly cron job
-- 2. Drop the materialized view (if it still exists)
-- 3. Drop the orphaned refresh function
--
-- SAVINGS: Eliminates hourly cron job execution and removes dead code
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Unschedule the cron job (runs hourly at minute 7)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('refresh_mv_best_times_hourly');
    RAISE NOTICE 'Unscheduled cron job: refresh_mv_best_times_hourly';
  ELSE
    RAISE NOTICE 'pg_cron not installed, skipping unschedule';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Cron job "refresh_mv_best_times_hourly" not found, skipping';
END $$;

-- ============================================================================
-- Step 2: Drop the materialized view (if it still exists)
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS public.mv_best_times CASCADE;

-- ============================================================================
-- Step 3: Drop the orphaned refresh function
-- ============================================================================

DROP FUNCTION IF EXISTS public.refresh_mv_best_times();

-- ============================================================================
-- Step 4: Verify cleanup
-- ============================================================================

DO $$
BEGIN
  -- Check MV is gone
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_best_times') THEN
    RAISE EXCEPTION 'mv_best_times still exists!';
  END IF;

  -- Check function is gone
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'refresh_mv_best_times'
  ) THEN
    RAISE EXCEPTION 'refresh_mv_best_times function still exists!';
  END IF;

  RAISE NOTICE 'Successfully removed mv_best_times and related resources';
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
--
-- REMOVED:
-- - mv_best_times materialized view
-- - refresh_mv_best_times() function
-- - refresh_mv_best_times_hourly cron job
--
-- IMPACT:
-- - No application code uses these resources (verified via grep)
-- - Only referenced in auto-generated types/database.generated.ts
-- - Run `yarn db:types` to regenerate types after applying this migration
--
-- ============================================================================
