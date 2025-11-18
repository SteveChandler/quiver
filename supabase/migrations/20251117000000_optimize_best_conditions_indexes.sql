-- ============================================================================
-- Migration: Optimize Best Conditions Query Performance
-- ============================================================================
-- Date: 2025-11-17
-- Purpose: Add missing indexes to fix 60s+ timeout in best conditions feature
--
-- PERFORMANCE ISSUES ADDRESSED:
-- 1. Missing composite index on user_beach_affinity(user_id, beach_id) - used in IN clause
-- 2. Suboptimal enhanced_forecasts index ordering for date+time range queries
-- 3. Missing beach_daily_intel(beach_id, generated_at DESC) covering index
-- 4. Missing session_media(media_type, created_at DESC) for photo queries
-- 5. No LIMIT on beach_daily_intel and session_media queries
--
-- EXPECTED IMPROVEMENT:
-- - Reduce query time from 60s+ to <2s (30x improvement)
-- - Enable index-only scans for common query patterns
-- - Optimize JOINs with sessions table
--
-- ROLLBACK: See 20251117000000_rollback_best_conditions_indexes.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. USER_BEACH_AFFINITY: Critical composite index for personalization
-- ============================================================================
-- Query pattern: SELECT ... WHERE user_id = ? AND beach_id IN (?, ?, ...)
-- Current: Full table scan on IN clause
-- Fixed: Composite index enables index seek on user_id + index scan on beach_id
--
-- Impact: Used on EVERY best conditions request for authenticated users
-- Rows: ~10K-100K affinity records (grows with user sessions)
-- Selectivity: Very high (user_id + beach_id is near-unique)

-- Drop existing single-column indexes (will be superseded by composite)
DROP INDEX IF EXISTS public.idx_user_beach_affinity_user;
DROP INDEX IF EXISTS public.idx_user_beach_affinity_beach;

-- Create optimal composite index with INCLUDE for covering index
-- This avoids table lookups for affinity_score, session_count, last_surfed_at
CREATE INDEX IF NOT EXISTS idx_user_beach_affinity_user_beach_covering
  ON public.user_beach_affinity (user_id, beach_id)
  INCLUDE (affinity_score, session_count, last_surfed_at);

COMMENT ON INDEX idx_user_beach_affinity_user_beach_covering IS
'Composite index for personalized recommendations. Covers the query:
SELECT beach_id, affinity_score, session_count, last_surfed_at
WHERE user_id = ? AND beach_id IN (...)
Reduces query time from full scan to index-only scan.';

-- Keep score-based index for user''s top beaches query
-- This is used separately for "your favorite spots" feature
-- (Not affected by composite index above)

-- ============================================================================
-- 2. ENHANCED_FORECASTS: Optimize date+time range queries
-- ============================================================================
-- Query pattern: WHERE forecast_date = ? AND beach_id IN (...) AND forecast_time >= ?
-- Current: idx_enhanced_forecasts_beach_date_time (beach_id, date, time)
-- Problem: Requires index scan across multiple beach_ids before date filtering
-- Fixed: Reverse order to filter by date first, then time, then beach_id
--
-- Impact: Used on EVERY best conditions request
-- Rows: ~500K-2M forecast records (24 hours × ~100 beaches × 10 days)
-- Selectivity: Date filter eliminates 90% of rows immediately

-- Drop less optimal existing index
DROP INDEX IF EXISTS public.idx_enhanced_forecasts_beach_date_time_optimized;

-- Create date-first composite index for current-day queries
-- Date is most selective (1/10 of rows), then time (reduces to 1/4 of remaining)
CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_date_time_beach
  ON public.enhanced_forecasts (forecast_date, forecast_time, beach_id);

COMMENT ON INDEX idx_enhanced_forecasts_date_time_beach IS
'Optimized for "best conditions right now" queries. Query pattern:
WHERE forecast_date = CURRENT_DATE
  AND beach_id IN (...)
  AND forecast_time >= CURRENT_TIME
ORDER BY forecast_time
Date-first ordering allows efficient date filtering before time/beach scans.';

-- Keep the beach-first index for single-beach forecast queries
-- (Different query pattern: WHERE beach_id = ? AND forecast_date >= ?)
-- Already exists: idx_enhanced_forecasts_beach_date_recent

-- ============================================================================
-- 3. BEACH_DAILY_INTEL: Add missing composite index for latest intel
-- ============================================================================
-- Query pattern: WHERE beach_id IN (...) ORDER BY generated_at DESC
-- Current: idx_beach_daily_intel_latest (beach_id, generated_at DESC)
-- Issue: No LIMIT in application code - must be added there
--
-- Impact: Used on EVERY best conditions request
-- Rows: ~3K-10K intel records (3 per day × ~100 beaches × 3 days retention)
-- Selectivity: Medium (100 beaches × 3 recent records = 300 rows scanned)

-- Verify the existing index is optimal
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'beach_daily_intel'
      AND indexname = 'idx_beach_daily_intel_latest'
  ) THEN
    -- Create if missing (shouldn't happen, but defensive)
    CREATE INDEX idx_beach_daily_intel_latest
      ON public.beach_daily_intel (beach_id, generated_at DESC);

    RAISE NOTICE 'Created missing index: idx_beach_daily_intel_latest';
  ELSE
    RAISE NOTICE 'Index already exists: idx_beach_daily_intel_latest';
  END IF;
END $$;

COMMENT ON INDEX idx_beach_daily_intel_latest IS
'Optimized for latest intel lookup per beach. Query pattern:
WHERE beach_id IN (...) ORDER BY generated_at DESC
WARNING: Application MUST add LIMIT clause to prevent scanning all intel records.';

-- ============================================================================
-- 4. SESSION_MEDIA: Add composite index for recent beach photos
-- ============================================================================
-- Query pattern: WHERE media_type IN (''photo'', ''image'')
--                AND session.beach_id IN (...)
--                ORDER BY created_at DESC
-- Current: Separate indexes on session_id and created_at
-- Problem: Sequential scan on media_type, inefficient JOIN
-- Fixed: Composite index on media_type + created_at for photo queries
--
-- Impact: Used on EVERY best conditions request
-- Rows: ~50K-500K media records (growing with user uploads)
-- Selectivity: Medium (media_type filters ~60% photos, created_at orders remainder)

-- Create media_type + created_at composite index
CREATE INDEX IF NOT EXISTS idx_session_media_photos_recent
  ON public.session_media (media_type, created_at DESC)
  WHERE media_type IN ('photo', 'image');

COMMENT ON INDEX idx_session_media_photos_recent IS
'Partial index for recent photo lookups. Query pattern:
SELECT ... FROM session_media sm
JOIN sessions s ON sm.session_id = s.id
WHERE sm.media_type IN (''photo'', ''image'')
  AND s.beach_id IN (...)
ORDER BY sm.created_at DESC
Partial index reduces size by 40% (photos only).
WARNING: Application MUST add LIMIT clause to prevent full scan.';

-- Keep existing session_id index for session detail pages
-- Keep existing user_id index for user profile pages
-- (Different query patterns not affected by this optimization)

-- ============================================================================
-- 5. SESSIONS: Verify beach_id index for session_media JOIN
-- ============================================================================
-- Query pattern (via session_media JOIN): WHERE beach_id IN (...)
-- Current: idx_sessions_beach_idx (beach_id, created_at DESC)
-- Status: Already optimal for JOIN
--
-- Impact: Used indirectly via session_media → sessions JOIN
-- Rows: ~20K-200K session records
-- Selectivity: High (beach_id partitions data well)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'sessions'
      AND indexname = 'sessions_beach_idx'
  ) THEN
    -- Create if missing (shouldn't happen, but defensive)
    CREATE INDEX sessions_beach_idx
      ON public.sessions (beach_id, created_at DESC);

    RAISE NOTICE 'Created missing index: sessions_beach_idx';
  ELSE
    RAISE NOTICE 'Index already exists: sessions_beach_idx';
  END IF;
END $$;

-- ============================================================================
-- 6. BEACHES: Verify spatial index for get_nearby_beaches RPC
-- ============================================================================
-- Query pattern (RPC): ST_DWithin(geog, target_point, radius)
-- Current: beaches_geog_gist (geog) using GIST
-- Status: Already optimal for spatial queries
--
-- Impact: Used on EVERY best conditions request (first query)
-- Rows: ~1K-10K beach records
-- Selectivity: Very high (radius filter eliminates 95%+ of beaches)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'beaches'
      AND indexname = 'beaches_geog_gist'
  ) THEN
    RAISE WARNING 'Missing critical spatial index: beaches_geog_gist';
    RAISE WARNING 'Run migration 20250904000002_add_beaches_geog_and_update_get_nearby_beaches.sql';
  ELSE
    RAISE NOTICE 'Spatial index exists: beaches_geog_gist';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (for local testing)
-- ============================================================================

-- Uncomment to verify indexes exist:
/*
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'user_beach_affinity',
    'enhanced_forecasts',
    'beach_daily_intel',
    'session_media',
    'sessions',
    'beaches'
  )
ORDER BY tablename, indexname;
*/

-- Uncomment to check index sizes:
/*
SELECT
  schemaname || '.' || tablename AS table,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'user_beach_affinity',
    'enhanced_forecasts',
    'beach_daily_intel',
    'session_media',
    'sessions',
    'beaches'
  )
ORDER BY pg_relation_size(indexrelid) DESC;
*/

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
--
-- APPLICATION CODE CHANGES REQUIRED:
--
-- 1. In beach-recommendation-service.ts:loadIntelData() (line 408):
--    ADD: .limit(beachIds.length * 3)  // 3 most recent intel per beach
--
-- 2. In beach-recommendation-service.ts:loadBeachPhotos() (line 327):
--    ADD: .limit(beachIds.length * 5)  // 5 most recent photos per beach
--
-- 3. Consider adding Redis/Upstash caching layer:
--    - Cache key: `best-conditions:${userId}:${lat},${lon}`
--    - TTL: 5 minutes
--    - Invalidate on new sessions/intel
--
-- MONITORING:
--
-- 1. Track query performance with Supabase dashboard:
--    - enhanced_forecasts query time (target: <100ms)
--    - user_beach_affinity query time (target: <50ms)
--    - Overall API response time (target: <2s)
--
-- 2. Monitor index usage:
--    SELECT * FROM pg_stat_user_indexes
--    WHERE schemaname = 'public'
--      AND indexrelname LIKE '%best_conditions%';
--
-- 3. Check for unused indexes after 1 week:
--    SELECT * FROM pg_stat_user_indexes
--    WHERE idx_scan = 0 AND idx_tup_read = 0;
--
-- ============================================================================
