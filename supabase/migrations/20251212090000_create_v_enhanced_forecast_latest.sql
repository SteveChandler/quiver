begin;

-- Speed up "latest per beach" lookups for monitoring/health checks.
-- The DESC sort helps DISTINCT ON / ORDER BY patterns.
create index if not exists idx_enhanced_forecasts_beach_updated_at_desc
  on public.enhanced_forecasts (beach_id, updated_at desc);

-- Latest enhanced forecast row per beach.
-- Uses security_invoker so underlying table RLS applies for the querying role.
create or replace view public.v_enhanced_forecast_latest
with (security_invoker = true) as
select distinct on (beach_id)
  beach_id,
  updated_at,
  data_source
from public.enhanced_forecasts
where updated_at is not null
order by beach_id, updated_at desc;

-- Allow service role to query the view (health check uses service role client).
grant select on public.v_enhanced_forecast_latest to service_role;

commit;

