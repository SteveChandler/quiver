-- Migration: Remove Unused Hourly Scores Materialized View
-- Purpose: Drop mv_beach_hourly_scores and related views/functions
--          These are not used by any application code (only in generated types)
--          Saves ~16MB storage and eliminates 2-hourly refresh compute

-- ============================================================================
-- Step 1: Unschedule the cron job that refreshes this MV
-- ============================================================================

-- Handle case where job doesn't exist on fresh databases
DO $$
BEGIN
  PERFORM cron.unschedule('refresh_mv_scores_every_2h');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron job "refresh_mv_scores_every_2h" not found, skipping unschedule';
END $$;

-- ============================================================================
-- Step 2: Drop the materialized view (saves ~16MB)
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS public.mv_beach_hourly_scores CASCADE;

-- ============================================================================
-- Step 3: Drop the refresh function (no longer needed)
-- ============================================================================

DROP FUNCTION IF EXISTS public.refresh_mv_beach_hourly_scores_and_analyze();
DROP FUNCTION IF EXISTS public.refresh_mv_beach_hourly_scores();

-- ============================================================================
-- Step 4: Drop the regular view if it exists (mv replaces this)
-- ============================================================================

DROP VIEW IF EXISTS public.v_beach_hourly_scores CASCADE;

-- ============================================================================
-- Step 5: Verify removal
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_beach_hourly_scores') THEN
    RAISE EXCEPTION 'mv_beach_hourly_scores still exists!';
  END IF;
  RAISE NOTICE 'mv_beach_hourly_scores successfully removed';
END $$;

COMMENT ON SCHEMA public IS 'Removed mv_beach_hourly_scores on 2026-01-13 - not used by app code';
