-- ============================================================================
-- Rollback Migration: Revert Best Conditions Index Optimizations
-- ============================================================================
-- Date: 2025-11-17
-- Purpose: Rollback indexes added in 20251117000000_optimize_best_conditions_indexes.sql
--
-- USE ONLY IF: Performance degradation or unexpected issues after optimization
--
-- This will:
-- 1. Drop new composite indexes
-- 2. Restore original single-column indexes
-- 3. Return database to pre-optimization state
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Rollback USER_BEACH_AFFINITY indexes
-- ============================================================================

-- Drop new composite covering index
DROP INDEX IF EXISTS public.idx_user_beach_affinity_user_beach_covering;

-- Restore original single-column indexes
CREATE INDEX IF NOT EXISTS idx_user_beach_affinity_user
  ON public.user_beach_affinity(user_id);

CREATE INDEX IF NOT EXISTS idx_user_beach_affinity_beach
  ON public.user_beach_affinity(beach_id);

-- Keep idx_user_beach_affinity_score (was not removed in optimization)

RAISE NOTICE 'Rolled back user_beach_affinity indexes to original state';

-- ============================================================================
-- 2. Rollback ENHANCED_FORECASTS indexes
-- ============================================================================

-- Drop new date-first composite index
DROP INDEX IF EXISTS public.idx_enhanced_forecasts_date_time_beach;

-- Restore original beach-first composite index
CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_beach_date_time_optimized
  ON public.enhanced_forecasts (beach_id, forecast_date, forecast_time);

-- Keep idx_enhanced_forecasts_beach_date_recent (was not removed)

RAISE NOTICE 'Rolled back enhanced_forecasts indexes to original state';

-- ============================================================================
-- 3. Rollback SESSION_MEDIA indexes
-- ============================================================================

-- Drop new partial index for photos
DROP INDEX IF EXISTS public.idx_session_media_photos_recent;

-- Original indexes remain (were not removed in optimization):
-- - idx_session_media_session_id
-- - idx_session_media_user_id
-- - idx_session_media_created_at
-- No restoration needed

RAISE NOTICE 'Rolled back session_media indexes to original state';

-- ============================================================================
-- 4. BEACH_DAILY_INTEL and SESSIONS indexes
-- ============================================================================
-- These were verification-only in the optimization migration
-- No changes to rollback

RAISE NOTICE 'No changes to beach_daily_intel or sessions indexes';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify rollback completed successfully
DO $$
DECLARE
  new_indexes TEXT[];
BEGIN
  -- Check that new indexes are gone
  SELECT ARRAY_AGG(indexname)
  INTO new_indexes
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN (
      'idx_user_beach_affinity_user_beach_covering',
      'idx_enhanced_forecasts_date_time_beach',
      'idx_session_media_photos_recent'
    );

  IF new_indexes IS NOT NULL AND array_length(new_indexes, 1) > 0 THEN
    RAISE WARNING 'Rollback incomplete. These indexes still exist: %', new_indexes;
  ELSE
    RAISE NOTICE '✅ Rollback successful - all optimization indexes removed';
  END IF;

  -- Check that original indexes are restored
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'user_beach_affinity'
      AND indexname IN ('idx_user_beach_affinity_user', 'idx_user_beach_affinity_beach')
  ) THEN
    RAISE WARNING 'Original user_beach_affinity indexes not fully restored';
  ELSE
    RAISE NOTICE '✅ Original user_beach_affinity indexes restored';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'enhanced_forecasts'
      AND indexname = 'idx_enhanced_forecasts_beach_date_time_optimized'
  ) THEN
    RAISE WARNING 'Original enhanced_forecasts index not restored';
  ELSE
    RAISE NOTICE '✅ Original enhanced_forecasts index restored';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-ROLLBACK NOTES
-- ============================================================================
--
-- After rolling back:
--
-- 1. Performance will return to pre-optimization state
--    - Best conditions queries may timeout again (>60s)
--    - User affinity lookups will be slower (full table scans)
--
-- 2. Application code changes (if made) can remain:
--    - .limit() clauses are still beneficial
--    - Caching layer still improves performance
--
-- 3. To investigate issues that required rollback:
--    - Check pg_stat_user_indexes for unused indexes
--    - Review query execution plans with EXPLAIN ANALYZE
--    - Monitor index bloat: pg_stat_user_tables.n_tup_upd
--
-- 4. Consider alternative optimizations:
--    - Materialized views for pre-computed results
--    - Partitioning large tables by date
--    - Connection pooling configuration
--
-- ============================================================================
