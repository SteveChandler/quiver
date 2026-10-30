-- The forecasts refresh re-upserts the same marine/tide rows every run, and
-- almost none of those updates are HOT (256 of 46,845 marine updates on
-- 2026-10-29). At the default 20% scale factor autovacuum waited for ~131k
-- dead marine rows, so dead index entries piled up: 1.8 GB of indexes on
-- ~465 MB of rows before the 2026-10-29 REINDEX.
--
-- Vacuum at ~2% dead instead. On marine_forecasts, leave 10% page room so
-- re-upserts that change no indexed column (observed and persistence rows)
-- can be HOT. fillfactor only applies to pages written from now on, so that
-- benefit builds up gradually. Tide rows always get a new created_at, so
-- fillfactor would not help there.
--
-- ponytail: settings only; the refresh still re-writes wind and tide rows with
-- a new created_at (it doubles as the stale-beach marker). Change that only if
-- index sizes regrow despite this.
--
-- ALTER TABLE ... SET (storage params) takes SHARE UPDATE EXCLUSIVE: reads and
-- writes continue. Rollback:
--   ALTER TABLE public.marine_forecasts RESET (autovacuum_vacuum_scale_factor, fillfactor);
--   ALTER TABLE public.tide_forecasts RESET (autovacuum_vacuum_scale_factor);

BEGIN;

-- The lock conflicts with a running (anti-wraparound) vacuum; fail fast instead of queueing.
SET LOCAL lock_timeout = '2s';

ALTER TABLE public.marine_forecasts
  SET (autovacuum_vacuum_scale_factor = 0.02, fillfactor = 90);

ALTER TABLE public.tide_forecasts
  SET (autovacuum_vacuum_scale_factor = 0.02);

COMMIT;
