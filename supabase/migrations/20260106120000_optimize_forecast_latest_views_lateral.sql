-- Migration: Optimize forecast latest views with LATERAL pattern
-- Purpose: Replace slow DISTINCT ON queries with fast LATERAL + LIMIT 1 pattern
-- Expected improvement: 3-10x faster queries depending on table size
--
-- This follows the same optimization applied to v_enhanced_forecast_latest in
-- migration 20260105161500_ensure_fast_v_enhanced_forecast_latest.sql

begin;

-- =============================================================================
-- MARINE FORECASTS VIEW OPTIMIZATION
-- =============================================================================

-- Create composite index for efficient latest-per-beach lookup
-- Order: beach_id (equality), is_observed DESC (prefer observed), created_at DESC (newest)
create index if not exists idx_marine_forecasts_beach_observed_created_desc
  on public.marine_forecasts (beach_id, is_observed desc, created_at desc);

-- Replace DISTINCT ON view with LATERAL pattern
-- The LATERAL subquery uses the index to find the single latest row per beach in O(1)
drop view if exists public.v_marine_forecast_latest;
create view public.v_marine_forecast_latest
with (security_invoker = true) as
select
  b.id as beach_id,
  mf.created_at,
  mf.ts,
  mf.source,
  mf.is_observed
from public.beaches b
cross join lateral (
  select m.created_at, m.ts, m.source, m.is_observed
  from public.marine_forecasts m
  where m.beach_id = b.id
  order by m.is_observed desc, m.created_at desc
  limit 1
) mf;

grant select on public.v_marine_forecast_latest to service_role;

-- =============================================================================
-- TIDE FORECASTS VIEW OPTIMIZATION
-- =============================================================================

-- Create composite index for efficient latest-per-beach lookup
create index if not exists idx_tide_forecasts_beach_created_desc
  on public.tide_forecasts (beach_id, created_at desc);

-- Replace DISTINCT ON view with LATERAL pattern
drop view if exists public.v_tide_forecast_latest;
create view public.v_tide_forecast_latest
with (security_invoker = true) as
select
  b.id as beach_id,
  tf.created_at,
  tf.ts,
  tf.source
from public.beaches b
cross join lateral (
  select t.created_at, t.ts, t.source
  from public.tide_forecasts t
  where t.beach_id = b.id
  order by t.created_at desc
  limit 1
) tf;

grant select on public.v_tide_forecast_latest to service_role;

-- =============================================================================
-- SUN TIMES VIEW OPTIMIZATION
-- =============================================================================

-- Create composite index for efficient latest-per-beach lookup
create index if not exists idx_sun_times_beach_created_desc
  on public.sun_times (beach_id, created_at desc);

-- Replace DISTINCT ON view with LATERAL pattern
drop view if exists public.v_sun_times_latest;
create view public.v_sun_times_latest
with (security_invoker = true) as
select
  b.id as beach_id,
  st.created_at,
  st.date,
  st.source
from public.beaches b
cross join lateral (
  select s.created_at, s.date, s.source
  from public.sun_times s
  where s.beach_id = b.id
  order by s.created_at desc
  limit 1
) st;

grant select on public.v_sun_times_latest to service_role;

commit;

-- =============================================================================
-- VERIFICATION QUERIES (run manually after migration)
-- =============================================================================
--
-- Check marine view performance:
-- EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.v_marine_forecast_latest;
-- Expected: Nested Loop with Index Scan on idx_marine_forecasts_beach_observed_created_desc
--
-- Check tide view performance:
-- EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.v_tide_forecast_latest;
-- Expected: Nested Loop with Index Scan on idx_tide_forecasts_beach_created_desc
--
-- Check sun times view performance:
-- EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.v_sun_times_latest;
-- Expected: Nested Loop with Index Scan on idx_sun_times_beach_created_desc
--
-- All views should execute in <50ms for ~260 beaches
