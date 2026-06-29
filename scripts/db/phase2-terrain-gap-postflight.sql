-- Read-only postflight for Phase 2 terrain gap writes.
--
-- Run after separately approved exact-ID terrain writes:
--   psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase2-terrain-gap-postflight.sql
--
-- This broad postflight verifies final coverage only. It is not approval evidence for a broad non-dry-run terrain command.
--
-- This fails if any active beach still lacks terrain_status,
-- swell_access_factors, or wind_exposure_factors, or if any factor array has
-- a non-72-bin length.

BEGIN READ ONLY;

\set phase2_terrain_gap_assertions_passed 0

SELECT 'phase2_postflight_terrain_coverage' AS check_name;

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
  (SELECT COUNT(*) FROM gaps) AS remaining_missing_status_or_factor_arrays,
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

SELECT 'phase2_postflight_assertions' AS check_name;

WITH active AS (
  SELECT *
  FROM public.beaches
  WHERE deleted_at IS NULL
),
assertions AS (
  SELECT
    'no_remaining_missing_status_or_factor_arrays' AS assertion,
    COUNT(*) FILTER (
      WHERE terrain_status IS NULL
         OR swell_access_factors IS NULL
         OR wind_exposure_factors IS NULL
    ) = 0 AS passed
  FROM active
  UNION ALL
  SELECT
    'all_active_have_72_bin_wind_and_swell',
    COUNT(*) FILTER (
      WHERE array_length(wind_exposure_factors, 1) = 72
        AND array_length(swell_access_factors, 1) = 72
    ) = COUNT(*) AS passed
  FROM active
  UNION ALL
  SELECT
    'no_invalid_factor_lengths',
    COUNT(*) FILTER (
      WHERE (wind_exposure_factors IS NOT NULL AND array_length(wind_exposure_factors, 1) IS DISTINCT FROM 72)
         OR (swell_access_factors IS NOT NULL AND array_length(swell_access_factors, 1) IS DISTINCT FROM 72)
    ) = 0 AS passed
  FROM active
)
SELECT assertion, passed
FROM assertions
ORDER BY assertion;

WITH active AS (
  SELECT *
  FROM public.beaches
  WHERE deleted_at IS NULL
),
assertions AS (
  SELECT COUNT(*) FILTER (
    WHERE terrain_status IS NULL
       OR swell_access_factors IS NULL
       OR wind_exposure_factors IS NULL
  ) = 0 AS passed
  FROM active
  UNION ALL
  SELECT COUNT(*) FILTER (
    WHERE array_length(wind_exposure_factors, 1) = 72
      AND array_length(swell_access_factors, 1) = 72
  ) = COUNT(*) AS passed
  FROM active
  UNION ALL
  SELECT COUNT(*) FILTER (
    WHERE (wind_exposure_factors IS NOT NULL AND array_length(wind_exposure_factors, 1) IS DISTINCT FROM 72)
       OR (swell_access_factors IS NOT NULL AND array_length(swell_access_factors, 1) IS DISTINCT FROM 72)
  ) = 0 AS passed
  FROM active
)
SELECT
  CASE
    WHEN bool_and(passed) THEN 1
    ELSE 0
  END AS phase2_terrain_gap_assertions_passed
FROM assertions
\gset

SELECT :phase2_terrain_gap_assertions_passed AS phase2_terrain_gap_assertions_passed;

SELECT 'phase2_remaining_gap_rows' AS check_name;

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
    OR array_length(wind_exposure_factors, 1) IS DISTINCT FROM 72
    OR array_length(swell_access_factors, 1) IS DISTINCT FROM 72
  )
ORDER BY region NULLS LAST, name;

\if :phase2_terrain_gap_assertions_passed
ROLLBACK;
\else
ROLLBACK;
DO $$
BEGIN
  RAISE EXCEPTION
    'Phase 2 terrain gap postflight assertions failed; see phase2_postflight_assertions and phase2_remaining_gap_rows above.';
END
$$;
\endif
