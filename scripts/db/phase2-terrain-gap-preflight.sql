-- Read-only preflight for Phase 2 terrain gap writes.
--
-- Run before generating a broad dry-run proposal for review:
--   yarn terrain:analyze --missing-only --dry-run --concurrency=4 --output-json=/tmp/quiver-phase2-terrain-proposed-current.json
--
-- This broad preflight does not approve a production write. Any non-dry-run
-- terrain write must be exact-ID scoped and carry fresh Phase 0 approval
-- artifacts plus the documented human approval token.
--
-- Command:
--   psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase2-terrain-gap-preflight.sql

BEGIN READ ONLY;

SELECT 'phase2_current_terrain_coverage' AS check_name;

WITH active AS (
  SELECT *
  FROM public.beaches
  WHERE deleted_at IS NULL
),
gaps AS (
  SELECT *
  FROM active
  WHERE terrain_status IS NULL
     OR swell_access_factors IS NULL
     OR wind_exposure_factors IS NULL
),
invalid_lengths AS (
  SELECT *
  FROM active
  WHERE (wind_exposure_factors IS NOT NULL AND array_length(wind_exposure_factors, 1) IS DISTINCT FROM 72)
     OR (swell_access_factors IS NOT NULL AND array_length(swell_access_factors, 1) IS DISTINCT FROM 72)
)
SELECT
  (SELECT COUNT(*) FROM active) AS active_beaches,
  (SELECT COUNT(*) FROM gaps) AS active_missing_status_or_factor_arrays,
  (
    SELECT COUNT(*)
    FROM active
    WHERE terrain_status IS NOT NULL
      AND wind_exposure_factors IS NOT NULL
      AND swell_access_factors IS NOT NULL
  ) AS active_with_status_and_factor_arrays,
  (
    SELECT COUNT(*)
    FROM active
    WHERE array_length(wind_exposure_factors, 1) = 72
      AND array_length(swell_access_factors, 1) = 72
  ) AS active_with_72_bin_wind_and_swell,
  (SELECT COUNT(*) FROM invalid_lengths) AS active_invalid_factor_lengths;

SELECT 'phase2_gap_regions' AS check_name;

SELECT
  COALESCE(region, 'unknown') AS region,
  COUNT(*) AS gap_beaches
FROM public.beaches
WHERE deleted_at IS NULL
  AND (
    terrain_status IS NULL
    OR swell_access_factors IS NULL
    OR wind_exposure_factors IS NULL
  )
GROUP BY COALESCE(region, 'unknown')
ORDER BY gap_beaches DESC, region;

SELECT 'phase2_gap_rows' AS check_name;

SELECT
  id,
  name,
  slug,
  region,
  terrain_status,
  terrain_method,
  array_length(wind_exposure_factors, 1) AS wind_factor_count,
  array_length(swell_access_factors, 1) AS swell_factor_count
FROM public.beaches
WHERE deleted_at IS NULL
  AND (
    terrain_status IS NULL
    OR swell_access_factors IS NULL
    OR wind_exposure_factors IS NULL
  )
ORDER BY region NULLS LAST, name;

ROLLBACK;
