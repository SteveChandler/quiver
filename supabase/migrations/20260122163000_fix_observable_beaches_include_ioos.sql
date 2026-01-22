-- Fix observable_beaches view to include IOOS stations
-- Problem: The original view only looked at marine_forecasts table,
-- missing IOOS observation data which is now our primary observation source.
-- This was causing backfill to find only ~5.9% match rate.

BEGIN;

-- Drop the existing materialized view
DROP MATERIALIZED VIEW IF EXISTS observable_beaches;

-- Recreate with both legacy marine_forecasts AND IOOS stations
CREATE MATERIALIZED VIEW observable_beaches AS
-- Legacy CDIP/NDBC observations from marine_forecasts
SELECT DISTINCT mf.beach_id
FROM marine_forecasts mf
WHERE mf.is_observed = true
  AND mf.wave_height_m IS NOT NULL
  AND mf.source IN ('cdip', 'ndbc')
UNION
-- IOOS stations with recent data (primary observation source now)
SELECT DISTINCT s.nearest_beach_id AS beach_id
FROM ioos_stations s
WHERE s.active = true
  AND s.has_wave_data = true
  AND s.nearest_beach_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM ioos_observations o
    WHERE o.station_id = s.station_id
      AND o.wave_height_m IS NOT NULL
      AND o.observed_at > NOW() - INTERVAL '7 days'
  )
WITH DATA;

-- Recreate unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX observable_beaches_beach_id_idx
ON observable_beaches (beach_id);

-- Grant SELECT access
GRANT SELECT ON observable_beaches TO authenticated, anon, service_role;

-- Update comment
COMMENT ON MATERIALIZED VIEW observable_beaches IS
'Beaches with observation sources (CDIP/NDBC in marine_forecasts OR IOOS stations).
Used to filter ML predictions to only target beaches with ground truth.
Fixed Jan 2026 to include IOOS stations which are now the primary observation source.
Refresh daily via refresh_observable_beaches() or after adding new sources.';

-- Refresh function already exists from original migration

COMMIT;
