-- Drop `beach_sources.ndbc_buoy_ids`.
--
-- The column has existed since 20250914090000 as `text[] NOT NULL DEFAULT '{}'`
-- and has never held a value: 128 of 128 rows are empty in production. Nothing
-- writes it — Seaside never references it, and the only web "writes" were a CSV
-- export script and the El Porto merge, which unions two already-empty arrays.
-- Wave provenance comes from CDIP (`wave_height_provenance.station_id`) and
-- NOAA_NWS, never NDBC.
--
-- STEP 2 OF 2. The sources endpoint stopped selecting this column in the same
-- change set; deploy that first and confirm it is live, or the running route's
-- SELECT will 500 for every beach between the migration and the deploy.
--
-- Rollback: supabase/rollbacks/20260827160000_drop_beach_sources_ndbc_buoy_ids_rollback.sql
-- (restores the column and its default; the values are unrecoverable and were
-- empty in every row, so nothing is lost.)

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.beach_sources
    WHERE ndbc_buoy_ids IS NOT NULL
      AND cardinality(ndbc_buoy_ids) > 0
  ) THEN
    RAISE EXCEPTION
      'drop blocked: beach_sources.ndbc_buoy_ids holds data on at least one row';
  END IF;
END $$;

ALTER TABLE public.beach_sources
  DROP COLUMN IF EXISTS ndbc_buoy_ids;

COMMIT;
