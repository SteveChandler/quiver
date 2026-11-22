-- Apply after the Nov 28 hybrid-gate Run 2 scores.
-- Marine forecast readers filter and order by ts; ts_utc remains a generated column.
-- In production, drop it first with psql -c outside a transaction:
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_marine_forecasts_beach_ts_utc;
-- This file then finds no index and records normally. It stays replayable in supabase db reset.

BEGIN;

DROP INDEX IF EXISTS public.idx_marine_forecasts_beach_ts_utc;

COMMIT;
