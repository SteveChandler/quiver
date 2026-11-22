-- Apply after the Nov 28 hybrid-gate Run 2 scores.
-- 20260113120100 removed the hourly scores view and its NWS wind lookup.
-- In production, drop it first with psql -c outside a transaction:
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_marine_forecasts_nws_wind_mv_lookup;
-- This file then finds no index and records normally. It stays replayable in supabase db reset.

BEGIN;

DROP INDEX IF EXISTS public.idx_marine_forecasts_nws_wind_mv_lookup;

COMMIT;
