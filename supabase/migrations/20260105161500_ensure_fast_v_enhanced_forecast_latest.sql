begin;

-- Ensure fast "latest per beach" reads for monitoring + selection.
-- This is queried via PostgREST from Edge runtime health checks and cron selection.
--
-- Idempotent: if the index already exists, this is a no-op.
create index if not exists idx_enhanced_forecasts_beach_updated_at_desc
  on public.enhanced_forecasts (beach_id, updated_at desc);

-- Latest enhanced forecast row per beach.
-- Uses security_invoker so underlying table RLS applies for the querying role.
-- NOTE: Application code filters orphaned rows at the app layer, so omit JOINs for performance.
create or replace view public.v_enhanced_forecast_latest
with (security_invoker = true) as
select distinct on (beach_id)
  beach_id,
  updated_at,
  data_source
from public.enhanced_forecasts
where updated_at is not null
order by beach_id, updated_at desc;

grant select on public.v_enhanced_forecast_latest to service_role;

commit;


