-- Allow FES2022 model tides in tide_forecasts.source.
--
-- The tide cron writes source = 'fes2022' (station_id 'FES2022') for the 50
-- Baja beaches with no NOAA station (#937, #949, shipped to prod in #953).
-- The check added in 20251220133000 only allows open-meteo, noaa and
-- noaa_hilo_interpolated, so the 2026-10-07 04:00 UTC run rejected every
-- FES2022 upsert and failed its 7-day coverage alarm for those 50 beaches.
--
-- The new list is a superset of the old one, so every existing row already
-- satisfies it. The constraint is added NOT VALID here, which needs only a
-- momentary ACCESS EXCLUSIVE lock and no scan of the ~1.2M-row table;
-- 20261007050100 validates it in its own transaction under a lock that does
-- not block reads or writes. lock_timeout makes this fail fast rather than
-- queue tide readers behind a long-running query.
BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.tide_forecasts
  DROP CONSTRAINT IF EXISTS tide_forecasts_source_check;

ALTER TABLE public.tide_forecasts
  ADD CONSTRAINT tide_forecasts_source_check
  CHECK (source IN ('open-meteo', 'noaa', 'noaa_hilo_interpolated', 'fes2022'))
  NOT VALID;

COMMIT;
