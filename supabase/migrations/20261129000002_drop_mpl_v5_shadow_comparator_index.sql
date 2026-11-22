-- pg-delta: transaction=false
-- Apply after the Nov 28 hybrid-gate Run 2 scores.
-- Current reports do not require all four non-null height columns in this predicate.
-- 20261104090000 moved buoy matching to read time instead of filling observed_m.
-- Run standalone outside a transaction, for example with psql -X -v ON_ERROR_STOP=1 -f.

DROP INDEX CONCURRENTLY IF EXISTS public.idx_mpl_v5_shadow_comparator;
