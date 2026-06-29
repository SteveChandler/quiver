-- Read-only postflight for the scoped Phase 2 Monterey Bay terrain write.
--
-- Run after the explicitly approved command:
--   yarn terrain:analyze --missing-only --beach-ids=a3d480de-3743-4dd7-8092-fb52772a0fb2,c0f23f4b-fcc4-4849-88f4-cb6da7206d80,885ad595-67cb-4408-b4cc-9ecf2ce3a848 --concurrency=3 --human-approval-token=2026-06-19-phase2-terrain-write-approved --approval-report-json=/tmp/quiver-phase2-terrain-auto-approval-harness.json --approval-proposed-json=/tmp/quiver-phase2-terrain-auto-approval-subset.json --min-approval-gate-samples=75 --min-approval-slice-samples=25 --max-approval-report-age-hours=24
--
-- Command:
--   psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase2-terrain-monterey-bay-postflight.sql
--
-- This script fails if the three approved Monterey Bay targets do not have
-- complete 72-bin wind and swell terrain factors. It is not a postflight for
-- any broader region-scoped terrain write.

BEGIN READ ONLY;

\set phase2_monterey_bay_assertions_passed 0

SELECT 'phase2_monterey_bay_postflight_summary' AS check_name;

WITH expected_target(beach_id, expected_name) AS (
  VALUES
    ('a3d480de-3743-4dd7-8092-fb52772a0fb2'::uuid, 'Del Monte Beach'),
    ('c0f23f4b-fcc4-4849-88f4-cb6da7206d80'::uuid, 'Marina State Beach'),
    ('885ad595-67cb-4408-b4cc-9ecf2ce3a848'::uuid, 'Moss Landing')
),
active AS (
  SELECT *
  FROM public.beaches
  WHERE deleted_at IS NULL
),
target AS (
  SELECT
    e.beach_id,
    e.expected_name,
    b.id,
    b.name,
    b.slug,
    b.region,
    b.terrain_status,
    b.terrain_method,
    b.wind_exposure_factors,
    b.swell_access_factors
  FROM expected_target e
  LEFT JOIN active b ON b.id = e.beach_id
)
SELECT
  (SELECT COUNT(*) FROM active) AS active_beaches,
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
  (SELECT COUNT(*) FROM expected_target) AS expected_target_rows,
  COUNT(*) FILTER (WHERE target.id IS NOT NULL) AS expected_active_found,
  COUNT(*) FILTER (
    WHERE target.terrain_status IS NOT NULL
      AND target.wind_exposure_factors IS NOT NULL
      AND target.swell_access_factors IS NOT NULL
  ) AS target_complete_rows,
  COUNT(*) FILTER (
    WHERE array_length(target.wind_exposure_factors, 1) = 72
      AND array_length(target.swell_access_factors, 1) = 72
  ) AS target_72_bin_rows,
  COUNT(*) FILTER (WHERE target.terrain_method = 'dem_horizon_v1') AS target_dem_horizon_v1_rows,
  COUNT(*) FILTER (WHERE target.id IS NULL) AS missing_or_deleted_rows
FROM target;

SELECT 'phase2_monterey_bay_postflight_assertions' AS check_name;

WITH expected_target(beach_id) AS (
  VALUES
    ('a3d480de-3743-4dd7-8092-fb52772a0fb2'::uuid),
    ('c0f23f4b-fcc4-4849-88f4-cb6da7206d80'::uuid),
    ('885ad595-67cb-4408-b4cc-9ecf2ce3a848'::uuid)
),
target AS (
  SELECT b.*
  FROM expected_target e
  LEFT JOIN public.beaches b
    ON b.id = e.beach_id
   AND b.deleted_at IS NULL
),
assertions AS (
  SELECT
    'all_three_targets_active' AS assertion,
    COUNT(id) = 3 AS passed
  FROM target
  UNION ALL
  SELECT
    'all_targets_complete',
    COUNT(*) FILTER (
      WHERE terrain_status IS NOT NULL
        AND wind_exposure_factors IS NOT NULL
        AND swell_access_factors IS NOT NULL
    ) = 3
  FROM target
  UNION ALL
  SELECT
    'all_targets_have_72_bin_wind_and_swell',
    COUNT(*) FILTER (
      WHERE array_length(wind_exposure_factors, 1) = 72
        AND array_length(swell_access_factors, 1) = 72
    ) = 3
  FROM target
  UNION ALL
  SELECT
    'all_targets_use_dem_horizon_v1',
    COUNT(*) FILTER (WHERE terrain_method = 'dem_horizon_v1') = 3
  FROM target
  UNION ALL
  SELECT
    'active_terrain_coverage_at_least_264',
    COUNT(*) FILTER (
      WHERE terrain_status IS NOT NULL
        AND wind_exposure_factors IS NOT NULL
        AND swell_access_factors IS NOT NULL
    ) >= 264
  FROM public.beaches
  WHERE deleted_at IS NULL
)
SELECT assertion, passed
FROM assertions
ORDER BY assertion;

SELECT 'phase2_monterey_bay_postflight_blockers' AS check_name;

WITH expected_target(beach_id) AS (
  VALUES
    ('a3d480de-3743-4dd7-8092-fb52772a0fb2'::uuid),
    ('c0f23f4b-fcc4-4849-88f4-cb6da7206d80'::uuid),
    ('885ad595-67cb-4408-b4cc-9ecf2ce3a848'::uuid)
),
target AS (
  SELECT b.*
  FROM expected_target e
  LEFT JOIN public.beaches b
    ON b.id = e.beach_id
   AND b.deleted_at IS NULL
),
summary AS (
  SELECT
    (SELECT COUNT(id) FROM target) AS active_target_rows,
    (
      SELECT COUNT(*) FILTER (
        WHERE terrain_status IS NOT NULL
          AND wind_exposure_factors IS NOT NULL
          AND swell_access_factors IS NOT NULL
      )
      FROM target
    ) AS target_complete_rows,
    (
      SELECT COUNT(*) FILTER (
        WHERE array_length(wind_exposure_factors, 1) = 72
          AND array_length(swell_access_factors, 1) = 72
      )
      FROM target
    ) AS target_72_bin_rows,
    (
      SELECT COUNT(*) FILTER (WHERE terrain_method = 'dem_horizon_v1')
      FROM target
    ) AS target_dem_horizon_v1_rows,
    (
      SELECT COUNT(*) FILTER (
        WHERE terrain_status IS NOT NULL
          AND wind_exposure_factors IS NOT NULL
          AND swell_access_factors IS NOT NULL
      )
      FROM public.beaches
      WHERE deleted_at IS NULL
    ) AS active_terrain_coverage
),
assertions AS (
  SELECT
    'all_three_targets_active' AS blocker_code,
    'The scoped Monterey Bay target set does not contain exactly 3 active beaches.' AS blocker_message,
    active_target_rows = 3 AS passed,
    CONCAT('active_target_rows=', active_target_rows, ', expected=3') AS detail
  FROM summary
  UNION ALL
  SELECT
    'all_targets_complete',
    'Not all scoped Monterey Bay targets have terrain_status plus wind and swell factor arrays.',
    target_complete_rows = 3,
    CONCAT('target_complete_rows=', target_complete_rows, ', expected=3')
  FROM summary
  UNION ALL
  SELECT
    'all_targets_have_72_bin_wind_and_swell',
    'Not all scoped Monterey Bay targets have 72-bin wind and swell terrain arrays.',
    target_72_bin_rows = 3,
    CONCAT('target_72_bin_rows=', target_72_bin_rows, ', expected=3')
  FROM summary
  UNION ALL
  SELECT
    'all_targets_use_dem_horizon_v1',
    'Not all scoped Monterey Bay targets use dem_horizon_v1 terrain factors.',
    target_dem_horizon_v1_rows = 3,
    CONCAT('target_dem_horizon_v1_rows=', target_dem_horizon_v1_rows, ', expected=3')
  FROM summary
  UNION ALL
  SELECT
    'active_terrain_coverage_at_least_264',
    'Active terrain coverage did not reach the scoped Monterey Bay floor of 264 beaches.',
    active_terrain_coverage >= 264,
    CONCAT('active_terrain_coverage=', active_terrain_coverage, ', expected_at_least=264')
  FROM summary
)
SELECT blocker_code, blocker_message, detail
FROM assertions
WHERE NOT passed
ORDER BY blocker_code;

WITH expected_target(beach_id) AS (
  VALUES
    ('a3d480de-3743-4dd7-8092-fb52772a0fb2'::uuid),
    ('c0f23f4b-fcc4-4849-88f4-cb6da7206d80'::uuid),
    ('885ad595-67cb-4408-b4cc-9ecf2ce3a848'::uuid)
),
target AS (
  SELECT b.*
  FROM expected_target e
  LEFT JOIN public.beaches b
    ON b.id = e.beach_id
   AND b.deleted_at IS NULL
),
assertions AS (
  SELECT COUNT(id) = 3 AS passed
  FROM target
  UNION ALL
  SELECT COUNT(*) FILTER (
    WHERE terrain_status IS NOT NULL
      AND wind_exposure_factors IS NOT NULL
      AND swell_access_factors IS NOT NULL
  ) = 3
  FROM target
  UNION ALL
  SELECT COUNT(*) FILTER (
    WHERE array_length(wind_exposure_factors, 1) = 72
      AND array_length(swell_access_factors, 1) = 72
  ) = 3
  FROM target
  UNION ALL
  SELECT COUNT(*) FILTER (WHERE terrain_method = 'dem_horizon_v1') = 3
  FROM target
  UNION ALL
  SELECT COUNT(*) FILTER (
    WHERE terrain_status IS NOT NULL
      AND wind_exposure_factors IS NOT NULL
      AND swell_access_factors IS NOT NULL
  ) >= 264
  FROM public.beaches
  WHERE deleted_at IS NULL
)
SELECT
  CASE
    WHEN bool_and(passed) THEN 1
    ELSE 0
  END AS phase2_monterey_bay_assertions_passed
FROM assertions
\gset

SELECT :phase2_monterey_bay_assertions_passed AS phase2_monterey_bay_assertions_passed;

SELECT 'phase2_monterey_bay_target_rows' AS check_name;

WITH expected_target(beach_id, expected_name) AS (
  VALUES
    ('a3d480de-3743-4dd7-8092-fb52772a0fb2'::uuid, 'Del Monte Beach'),
    ('c0f23f4b-fcc4-4849-88f4-cb6da7206d80'::uuid, 'Marina State Beach'),
    ('885ad595-67cb-4408-b4cc-9ecf2ce3a848'::uuid, 'Moss Landing')
)
SELECT
  e.expected_name,
  b.id,
  b.name,
  b.slug,
  b.region,
  b.terrain_status,
  b.terrain_method,
  array_length(b.wind_exposure_factors, 1) AS wind_factor_count,
  array_length(b.swell_access_factors, 1) AS swell_factor_count
FROM expected_target e
LEFT JOIN public.beaches b
  ON b.id = e.beach_id
 AND b.deleted_at IS NULL
ORDER BY e.expected_name;

\if :phase2_monterey_bay_assertions_passed
ROLLBACK;
\else
ROLLBACK;
DO $$
BEGIN
  RAISE EXCEPTION
    'Phase 2 Monterey Bay terrain postflight assertions failed; see phase2_monterey_bay_postflight_blockers, phase2_monterey_bay_postflight_assertions, and target rows above.';
END
$$;
\endif
