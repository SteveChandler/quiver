-- Rollback for docs/operations/tide-station-supersede-20260929.sql.
--
-- Restores the removed rows from the private backup table. Run only with
-- separate approval (docs/MIGRATION_SAFETY.md). The backup table is kept;
-- drop it in a separate, approved step once the restore is verified.

BEGIN;

DO $$
BEGIN
  IF current_setting('app.tide_station_supersede_rollback_approved', true) IS DISTINCT FROM
    '2026-09-29-tide-station-supersede-rollback-approved'
  THEN
    RAISE EXCEPTION 'Tide station supersede rollback requires explicit human approval.';
  END IF;

  IF to_regclass('private.tide_forecasts_station_supersede_backup_20260929') IS NULL THEN
    RAISE EXCEPTION 'Tide station supersede backup table is missing.';
  END IF;
END $$;

SET LOCAL lock_timeout = '5s';
LOCK TABLE public.tide_forecasts IN SHARE ROW EXCLUSIVE MODE;

-- A later refresh may have written the same (beach_id, ts, source) slot.
-- Restoring over it would lose the newer row, so stop and reconcile by hand.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM private.tide_forecasts_station_supersede_backup_20260929 backup
    JOIN public.tide_forecasts current_row
      ON current_row.beach_id = backup.beach_id
      AND current_row.ts = backup.ts
      AND current_row.source = backup.source
  ) THEN
    RAISE EXCEPTION
      'Rollback would collide with tide rows written after the correction; reconcile them manually.';
  END IF;
END $$;

INSERT INTO public.tide_forecasts (
  id,
  beach_id,
  ts,
  tide_height_m,
  tide_phase,
  source,
  created_at,
  station_id
)
SELECT
  id,
  beach_id,
  ts,
  tide_height_m,
  tide_phase,
  source,
  created_at,
  station_id
FROM private.tide_forecasts_station_supersede_backup_20260929;

DO $$
DECLARE
  restored bigint;
  backed_up bigint;
BEGIN
  SELECT COUNT(*) INTO backed_up
  FROM private.tide_forecasts_station_supersede_backup_20260929;

  SELECT COUNT(*) INTO restored
  FROM public.tide_forecasts forecasts
  JOIN private.tide_forecasts_station_supersede_backup_20260929 backup
    ON backup.id = forecasts.id;

  IF restored <> backed_up THEN
    RAISE EXCEPTION 'Rollback restored % of % rows', restored, backed_up;
  END IF;
END $$;

COMMIT;
