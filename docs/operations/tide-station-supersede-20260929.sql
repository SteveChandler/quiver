-- Tide station supersede correction, 2026-09-29.
--
-- PROPOSED, NOT RUN. Plan and approval protocol:
-- docs/operations/tide-station-supersede-20260929.md
--
-- Removes tide_forecasts rows written for a station a beach no longer uses,
-- over the span its current station covers. The current station is the
-- station of the beach's most recently written row. Each removed row is
-- copied to a private backup table first; the rollback restores from it.
--
-- Reviewed targets (read-only preflight, 2026-09-29 12:28 UTC):
--   5e8d07ff-786c-4b7e-ab19-53d2b3774e23 shipwrecks-coronado-ca          TWC0405 -> 9410170  384 rows
--   281b7eef-bcc3-4ecd-998f-1faa190ed956 la-push-second-beach-la-push-wa 9442396 -> 9442388  553 rows
--   9841bdd0-e70f-4c10-bc54-135575006298 malibu-first-point-surfrider    TWC0445 -> 9410840  648 rows
-- The transaction aborts if the targets differ in any way.

BEGIN;

DO $$
BEGIN
  IF current_setting('app.tide_station_supersede_approved', true) IS DISTINCT FROM
    '2026-09-29-tide-station-supersede-approved'
  THEN
    RAISE EXCEPTION 'Tide station supersede correction requires explicit human approval.';
  END IF;

  IF to_regclass('private.tide_forecasts_station_supersede_backup_20260929') IS NOT NULL THEN
    RAISE EXCEPTION 'Backup table already exists; this correction has already run.';
  END IF;
END $$;

-- Readers continue; the tide cron and the retention prune wait (or this
-- fails fast) so the reviewed targets cannot move under the delete.
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.tide_forecasts IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE tide_station_supersede_targets ON COMMIT DROP AS
WITH current_station AS (
  SELECT DISTINCT ON (beach_id)
    beach_id,
    station_id
  FROM public.tide_forecasts
  WHERE station_id IS NOT NULL
  ORDER BY beach_id, created_at DESC, id DESC
),
current_span AS (
  SELECT
    forecasts.beach_id,
    current_station.station_id,
    MIN(forecasts.ts) AS current_from
  FROM public.tide_forecasts forecasts
  JOIN current_station
    ON current_station.beach_id = forecasts.beach_id
    AND current_station.station_id = forecasts.station_id
  GROUP BY forecasts.beach_id, current_station.station_id
)
SELECT forecasts.id, forecasts.beach_id
FROM public.tide_forecasts forecasts
JOIN current_span
  ON current_span.beach_id = forecasts.beach_id
WHERE forecasts.station_id IS NOT NULL
  AND forecasts.station_id <> current_span.station_id
  AND forecasts.ts >= current_span.current_from;

DO $$
DECLARE
  expected CONSTANT jsonb := '{
    "281b7eef-bcc3-4ecd-998f-1faa190ed956": 553,
    "5e8d07ff-786c-4b7e-ab19-53d2b3774e23": 384,
    "9841bdd0-e70f-4c10-bc54-135575006298": 648
  }'::jsonb;
  actual jsonb;
BEGIN
  SELECT COALESCE(jsonb_object_agg(beach_id, row_count), '{}'::jsonb)
  INTO actual
  FROM (
    SELECT beach_id::text AS beach_id, COUNT(*) AS row_count
    FROM tide_station_supersede_targets
    GROUP BY beach_id
  ) counts;

  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION
      'Tide station supersede targets changed since review: expected %, found %',
      expected,
      actual;
  END IF;
END $$;

CREATE TABLE private.tide_forecasts_station_supersede_backup_20260929 AS
SELECT
  forecasts.id,
  forecasts.beach_id,
  forecasts.ts,
  forecasts.tide_height_m,
  forecasts.tide_phase,
  forecasts.source,
  forecasts.created_at,
  forecasts.station_id
FROM public.tide_forecasts forecasts
JOIN tide_station_supersede_targets targets
  ON targets.id = forecasts.id;

REVOKE ALL ON TABLE private.tide_forecasts_station_supersede_backup_20260929
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE private.tide_forecasts_station_supersede_backup_20260929 IS
  'Rows removed by docs/operations/tide-station-supersede-20260929.sql.';

DELETE FROM public.tide_forecasts forecasts
USING tide_station_supersede_targets targets
WHERE forecasts.id = targets.id;

DO $$
DECLARE
  backed_up bigint;
  remaining bigint;
BEGIN
  SELECT COUNT(*) INTO backed_up
  FROM private.tide_forecasts_station_supersede_backup_20260929;

  SELECT COUNT(*) INTO remaining
  FROM public.tide_forecasts forecasts
  JOIN private.tide_forecasts_station_supersede_backup_20260929 backup
    ON backup.id = forecasts.id;

  RAISE NOTICE 'Tide station supersede: backed up %, remaining %', backed_up, remaining;

  IF backed_up <> 1585 OR remaining <> 0 THEN
    RAISE EXCEPTION
      'Tide station supersede incomplete: backed up %, remaining %',
      backed_up,
      remaining;
  END IF;
END $$;

COMMIT;
