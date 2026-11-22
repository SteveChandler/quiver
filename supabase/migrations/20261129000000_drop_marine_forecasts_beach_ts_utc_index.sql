-- pg-delta: transaction=false
-- Apply after the Nov 28 hybrid-gate Run 2 scores.
-- Marine forecast readers filter and order by ts; ts_utc remains a generated column.
-- Run standalone outside a transaction, for example with psql -X -v ON_ERROR_STOP=1 -f.

DROP INDEX CONCURRENTLY IF EXISTS public.idx_marine_forecasts_beach_ts_utc;
