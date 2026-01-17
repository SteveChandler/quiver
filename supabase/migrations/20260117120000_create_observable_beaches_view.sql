-- Create materialized view of beaches with valid observation sources
-- This identifies beaches that have CDIP/NDBC observation data with wave heights,
-- allowing ML predictions to focus only on beaches with ground truth for validation.
-- Currently ~96 of 261 beaches have valid observation sources.

BEGIN;

-- Create materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS observable_beaches AS
SELECT DISTINCT mf.beach_id
FROM marine_forecasts mf
WHERE mf.is_observed = true
  AND mf.wave_height_m IS NOT NULL
  AND mf.source IN ('cdip', 'ndbc')
WITH DATA;

-- Index for fast lookups (UNIQUE allows CONCURRENTLY refresh)
CREATE UNIQUE INDEX IF NOT EXISTS observable_beaches_beach_id_idx
ON observable_beaches (beach_id);

-- Refresh function (call daily or after new observation sources added)
-- Uses CONCURRENTLY to avoid locking reads during refresh
CREATE OR REPLACE FUNCTION refresh_observable_beaches()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY observable_beaches;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Grant SELECT access for all roles that need to query this view
GRANT SELECT ON observable_beaches TO authenticated, anon, service_role;

-- Document the view's purpose and refresh strategy
COMMENT ON MATERIALIZED VIEW observable_beaches IS
'Beaches with at least one valid observation (CDIP/NDBC with wave height).
Used to filter ML predictions to only target beaches with ground truth.
Refresh daily via refresh_observable_beaches() or after adding new sources.';

COMMIT;
