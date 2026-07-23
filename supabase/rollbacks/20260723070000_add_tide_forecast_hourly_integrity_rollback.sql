-- Rollback for 20260723070000_add_tide_forecast_hourly_integrity.sql.
--
-- This restores the archived pre-cleanup rows and removes station provenance.
-- Run only after pausing the tide writer and receiving separate approval.

BEGIN;

DO $$
BEGIN
  IF current_setting(
    'app.tide_forecast_integrity_rollback_approved',
    true
  ) IS DISTINCT FROM
    '2026-07-23-tide-forecast-integrity-rollback-approved'
  THEN
    RAISE EXCEPTION
      'Tide forecast integrity rollback requires explicit human approval.';
  END IF;

  IF to_regclass(
    'private.tide_forecasts_integrity_backup_20260723'
  ) IS NULL THEN
    RAISE EXCEPTION
      'Tide forecast integrity backup table is missing.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM private.tide_forecasts_integrity_backup_20260723 backup
    JOIN public.tide_forecasts current_row
      ON current_row.beach_id = backup.beach_id
      AND current_row.ts = backup.ts
      AND current_row.source = backup.source
      AND current_row.id <> backup.id
  ) THEN
    RAISE EXCEPTION
      'Rollback would overwrite tide rows written after cleanup; reconcile them manually.';
  END IF;
END $$;

DELETE FROM public.tide_forecasts forecasts
USING private.tide_forecasts_integrity_backup_20260723 backup
WHERE forecasts.id = backup.id;

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
FROM private.tide_forecasts_integrity_backup_20260723;

DROP INDEX IF EXISTS public.idx_tide_forecasts_station_ts;

ALTER TABLE public.tide_forecasts
  DROP COLUMN IF EXISTS station_id;

DROP TABLE private.tide_forecasts_integrity_backup_20260723;

NOTIFY pgrst, 'reload schema';

COMMIT;
