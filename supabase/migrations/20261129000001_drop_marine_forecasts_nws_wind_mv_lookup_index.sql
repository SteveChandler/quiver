-- pg-delta: transaction=false
-- Apply after the Nov 28 hybrid-gate Run 2 scores.
-- 20260113120100 removed the hourly scores view and its NWS wind lookup.
-- Run standalone outside a transaction, for example with psql -X -v ON_ERROR_STOP=1 -f.

DROP INDEX CONCURRENTLY IF EXISTS public.idx_marine_forecasts_nws_wind_mv_lookup;
