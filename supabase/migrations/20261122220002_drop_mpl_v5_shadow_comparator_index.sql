-- Apply after the Nov 28 hybrid-gate Run 2 scores.
-- Current reports do not require all four non-null height columns in this predicate.
-- 20261104090000 moved buoy matching to read time instead of filling observed_m.
-- In production, drop it first with psql -c outside a transaction:
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_mpl_v5_shadow_comparator;
-- This file then finds no index and records normally. It stays replayable in supabase db reset.

BEGIN;

DROP INDEX IF EXISTS public.idx_mpl_v5_shadow_comparator;

COMMIT;
