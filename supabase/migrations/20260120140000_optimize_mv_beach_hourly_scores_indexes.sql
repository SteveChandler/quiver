-- Optimize mv_beach_hourly_scores refresh performance
--
-- Problem: Refresh takes ~16 seconds due to LATERAL subquery cache thrashing
-- - 108,909 marine forecast rows × 2 LATERAL lookups = 218K subqueries
-- - Memoize cache: 31% hit rate, 24,736 evictions
--
-- Solution: Add covering indexes to eliminate heap lookups in LATERAL subqueries
-- Expected improvement: 16s → 8-10s refresh time
--
-- Reference: docs/research/2026-01-20-query-performance-investigation.md

-- Covering index for tide lookups in MV refresh
-- Includes tide_height_m to avoid heap lookup after index scan
-- Note: For manual application on large tables, use CONCURRENTLY to avoid locks
CREATE INDEX IF NOT EXISTS idx_tide_forecasts_mv_lookup
  ON public.tide_forecasts (beach_id, ts)
  INCLUDE (tide_height_m);

-- Partial covering index for NWS wind lookups in MV refresh
-- Only indexes source='nws_wind' rows (smaller index, faster scans)
-- Includes wind columns to avoid heap lookup
CREATE INDEX IF NOT EXISTS idx_marine_forecasts_nws_wind_mv_lookup
  ON public.marine_forecasts (beach_id, ts)
  INCLUDE (wind_speed_ms, wind_direction_deg)
  WHERE source = 'nws_wind';

-- Analyze tables to update statistics for query planner
ANALYZE public.tide_forecasts;
ANALYZE public.marine_forecasts;
