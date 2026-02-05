-- Tighten observable_beaches to only include beaches with active IOOS observation sources
--
-- Problem: The current view includes 118 beaches that have no active observation sources:
-- 1. Legacy path: Any beach in marine_forecasts with source IN ('cdip', 'ndbc') - no recency check
-- 2. IOOS path: 7-day threshold is too loose
--
-- This causes:
-- - Match rate dropped to 21% (should be ~57%)
-- - Pending queue inflated to 76K
-- - 927K wasted predictions/week on beaches without ground truth
--
-- Fix: Remove legacy path entirely, tighten IOOS to 24h recency requirement

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS observable_beaches;

CREATE MATERIALIZED VIEW observable_beaches AS
SELECT DISTINCT s.nearest_beach_id AS beach_id
FROM ioos_stations s
WHERE s.active = true
  AND s.has_wave_data = true
  AND s.nearest_beach_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM ioos_observations o
    WHERE o.station_id = s.station_id
      AND o.wave_height_m IS NOT NULL
      AND o.observed_at > NOW() - INTERVAL '24 hours'
  )
WITH DATA;

CREATE UNIQUE INDEX idx_observable_beaches_beach_id ON observable_beaches(beach_id);

-- Grant SELECT access
GRANT SELECT ON observable_beaches TO authenticated, anon, service_role;

COMMENT ON MATERIALIZED VIEW observable_beaches IS
'Beaches with active IOOS observation sources (observations within 24h).
Used to filter ML predictions to only target beaches with ground truth.
Tightened Feb 2026 to remove legacy marine_forecasts path and require 24h recency.
Refresh daily via refresh_observable_beaches() or after adding new sources.';

-- Refresh to populate with new criteria
REFRESH MATERIALIZED VIEW observable_beaches;

COMMIT;
