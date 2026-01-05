begin;

-- Optimize "latest per beach" reads for monitoring/cron selection.
--
-- This view is queried via PostgREST from Edge runtime health checks. In some environments,
-- the previous JOIN-based definition increased planner work enough to hit statement timeouts.
--
-- NOTE: Application code consuming this view already ignores orphaned rows (beach_ids not present
-- in public.beaches) when computing coverage, so we can safely omit the JOIN for performance.
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


