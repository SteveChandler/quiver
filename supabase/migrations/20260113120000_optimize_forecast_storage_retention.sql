-- Migration: Optimize Forecast Storage Retention
-- Purpose: Reduce database storage by ~250MB through:
-- 1. Updating retention from 30 days to 7 days for marine/tide, 14 days for enhanced
-- 2. Dropping redundant index on tide_forecasts (saves ~30MB)
-- 3. Immediate cleanup of old data

-- ============================================================================
-- Step 1: Update the prune_forecasts_retention function to use shorter retention
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prune_forecasts_retention(
  keep_days_raw integer DEFAULT 7,        -- Changed from 30 to 7 for raw forecasts
  keep_days_enhanced integer DEFAULT 14,  -- Keep enhanced forecasts longer
  batch_size integer DEFAULT 25000
)
RETURNS TABLE(marine_deleted bigint, tide_deleted bigint, enhanced_deleted bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cutoff_ts_raw timestamptz := now() - make_interval(days => keep_days_raw);
  cutoff_date_enhanced date := current_date - keep_days_enhanced;
  v_deleted int;
BEGIN
  marine_deleted := 0;
  tide_deleted := 0;
  enhanced_deleted := 0;

  -- Delete old marine_forecasts (7 day retention)
  LOOP
    DELETE FROM public.marine_forecasts
    WHERE ctid IN (
      SELECT ctid
      FROM public.marine_forecasts
      WHERE ts < cutoff_ts_raw
      LIMIT batch_size
    );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    marine_deleted := marine_deleted + v_deleted;
    EXIT WHEN v_deleted = 0;
  END LOOP;

  -- Delete old tide_forecasts (7 day retention)
  LOOP
    DELETE FROM public.tide_forecasts
    WHERE ctid IN (
      SELECT ctid
      FROM public.tide_forecasts
      WHERE ts < cutoff_ts_raw
      LIMIT batch_size
    );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    tide_deleted := tide_deleted + v_deleted;
    EXIT WHEN v_deleted = 0;
  END LOOP;

  -- Delete old enhanced_forecasts (14 day retention)
  LOOP
    DELETE FROM public.enhanced_forecasts
    WHERE ctid IN (
      SELECT ctid
      FROM public.enhanced_forecasts
      WHERE forecast_date::date < cutoff_date_enhanced
      LIMIT batch_size
    );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    enhanced_deleted := enhanced_deleted + v_deleted;
    EXIT WHEN v_deleted = 0;
  END LOOP;

  RETURN NEXT;
END;
$function$;

-- ============================================================================
-- Step 2: Update the cron job to use new default parameters
-- ============================================================================

-- Unschedule the old job (handle case where job doesn't exist on fresh databases)
DO $$
BEGIN
  PERFORM cron.unschedule('prune_forecasts_retention');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron job "prune_forecasts_retention" not found, skipping unschedule';
END $$;

-- Schedule new job with updated parameters (7 days for raw, 14 for enhanced)
SELECT cron.schedule(
  'prune_forecasts_retention',
  '0 5 * * *',  -- Run at 5am daily
  $$SELECT public.prune_forecasts_retention(7, 14, 25000);$$
);

-- ============================================================================
-- Step 3: Drop redundant index on tide_forecasts
-- The unique constraint tide_forecasts_unique (beach_id, ts, source) already
-- covers queries on (beach_id, ts), making idx_tide_forecasts_beach_ts redundant.
-- Saves approximately 30MB.
-- ============================================================================

DROP INDEX IF EXISTS public.idx_tide_forecasts_beach_ts;

-- ============================================================================
-- Step 4: Run immediate cleanup to free space (one-time)
-- This will delete ~28 days of old data
-- NOTE: For production databases with large datasets, consider running this
-- separately after the migration to avoid transaction timeout issues:
--   SELECT * FROM public.prune_forecasts_retention(7, 14, 25000);
-- ============================================================================

-- Run the cleanup function with error handling to prevent migration failure
DO $$
DECLARE
  result RECORD;
BEGIN
  -- Set a statement timeout for this block (5 minutes)
  SET LOCAL statement_timeout = '300s';

  SELECT * INTO result FROM public.prune_forecasts_retention(7, 14, 25000);
  RAISE NOTICE 'Cleanup complete - deleted: marine=%, tide=%, enhanced=%',
    result.marine_deleted, result.tide_deleted, result.enhanced_deleted;
EXCEPTION
  WHEN query_canceled THEN
    RAISE WARNING 'Cleanup timed out. Run manually after migration: SELECT * FROM public.prune_forecasts_retention(7, 14, 25000);';
  WHEN OTHERS THEN
    RAISE WARNING 'Cleanup failed (%). Run manually after migration: SELECT * FROM public.prune_forecasts_retention(7, 14, 25000);', SQLERRM;
END $$;

-- ============================================================================
-- Step 5: VACUUM ANALYZE to reclaim disk space
-- Note: This may take a few minutes for large tables
-- ============================================================================

-- VACUUM cannot run inside a transaction block in migrations,
-- but Supabase will handle this automatically.
-- For immediate results, run manually:
-- VACUUM ANALYZE tide_forecasts;
-- VACUUM ANALYZE marine_forecasts;
-- VACUUM ANALYZE enhanced_forecasts;

COMMENT ON FUNCTION public.prune_forecasts_retention IS
'Prunes old forecast data to reduce storage.
Default retention: 7 days for marine/tide_forecasts, 14 days for enhanced_forecasts.
Runs in batches to avoid locking.
Scheduled to run daily at 5am via pg_cron.';
