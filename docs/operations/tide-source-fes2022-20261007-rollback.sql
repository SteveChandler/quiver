-- Rollback for 20261007050000 / 20261007050100 (allow 'fes2022' in
-- tide_forecasts_source_check). Pick ONE branch.
--
-- Branch A (default, non-destructive): restore the three-value list as
-- NOT VALID. Existing fes2022 rows stay and readers keep showing them; new
-- fes2022 writes are rejected again and the tide cron's coverage alarm
-- fires for the 50 Baja beaches, as it did on 2026-10-07.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.tide_forecasts DROP CONSTRAINT IF EXISTS tide_forecasts_source_check;
ALTER TABLE public.tide_forecasts
  ADD CONSTRAINT tide_forecasts_source_check
  CHECK (source IN ('open-meteo', 'noaa', 'noaa_hilo_interpolated'))
  NOT VALID;
COMMIT;

-- Branch B (DESTRUCTIVE, needs its own APPROVE: <sha>): remove the fes2022
-- rows, then restore the validated three-value constraint exactly as it was
-- before 2026-10-07. Only use this to return the table to its prior state.
--
-- BEGIN;
-- SET LOCAL lock_timeout = '5s';
-- DELETE FROM public.tide_forecasts WHERE source = 'fes2022';
-- ALTER TABLE public.tide_forecasts DROP CONSTRAINT IF EXISTS tide_forecasts_source_check;
-- ALTER TABLE public.tide_forecasts
--   ADD CONSTRAINT tide_forecasts_source_check
--   CHECK (source IN ('open-meteo', 'noaa', 'noaa_hilo_interpolated'));
-- COMMIT;
--
-- After either branch, delete the two tracking rows so a later push can
-- re-apply the forward migrations:
-- DELETE FROM supabase_migrations.schema_migrations
--   WHERE version IN ('20261007050000', '20261007050100');
