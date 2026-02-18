-- Fix v_marine_forecast_latest to not prefer stale observed (buoy) data
-- over fresh forecast data.
--
-- Problem:
-- The view uses ORDER BY is_observed DESC, created_at DESC which unconditionally
-- prefers buoy observations. When a buoy goes offline (common with NDBC stations),
-- the view returns week/month-old observed rows instead of fresh forecast data
-- from nws_wind or ndbc_persistence sources.
--
-- Affected beaches (as of Feb 2026):
-- - New Smyrna Beach / Ponce Inlet (FL) — buoy 41069 offline since Jan 4
-- - Belmar / Long Branch / Asbury Park / Manasquan Inlet (NJ) — buoy 44065 intermittent
-- - Bodega Bay / Doran Beach (CA) — buoy 46013 gappy
--
-- Fix:
-- Use UNION ALL with short-circuit LIMIT 1:
--   1. Try to find a fresh observed row (< 6h old) — uses existing composite index
--   2. Fall back to the newest row regardless of type — uses new created_at index
-- Postgres short-circuits: if query 1 returns a row, query 2 never executes.
--
-- Performance:
-- Both subqueries use index scans (O(1) per beach), preserving the LATERAL + LIMIT 1
-- optimization from the original view.
--
-- Consumers:
-- - app/api/cron/forecasts/refresh/route.ts (selectStaleBeaches) — benefits from accurate freshness
-- - lib/monitoring/forecast-health-check.ts — fixes false "critical stale" alerts
-- - app-stats dashboard — fixes inflated marine stale counts
--
-- Date: 2026-02-18

BEGIN;

-- New index for the fallback query (ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_marine_forecasts_beach_created_desc
  ON public.marine_forecasts (beach_id, created_at DESC);

DROP VIEW IF EXISTS public.v_marine_forecast_latest;

CREATE VIEW public.v_marine_forecast_latest
WITH (security_invoker = true) AS
SELECT
  b.id AS beach_id,
  mf.created_at,
  mf.ts,
  mf.source,
  mf.is_observed
FROM beaches b
CROSS JOIN LATERAL (
  -- First: try fresh observed data (buoy reading < 6h old)
  -- Uses idx_marine_forecasts_beach_observed_created_desc
  (SELECT m.created_at, m.ts, m.source, m.is_observed
   FROM marine_forecasts m
   WHERE m.beach_id = b.id
     AND m.is_observed = true
     AND m.created_at > NOW() - INTERVAL '6 hours'
   ORDER BY m.created_at DESC
   LIMIT 1)

  UNION ALL

  -- Fallback: newest row regardless of type
  -- Uses idx_marine_forecasts_beach_created_desc
  (SELECT m.created_at, m.ts, m.source, m.is_observed
   FROM marine_forecasts m
   WHERE m.beach_id = b.id
   ORDER BY m.created_at DESC
   LIMIT 1)

  LIMIT 1
) mf;

GRANT SELECT ON public.v_marine_forecast_latest TO service_role;

COMMIT;
