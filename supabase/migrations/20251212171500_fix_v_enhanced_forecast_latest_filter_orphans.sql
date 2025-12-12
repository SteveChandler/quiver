begin;

-- Filter out orphaned enhanced_forecasts rows that reference beach_ids not present in public.beaches.
-- Some environments may contain legacy rows without a foreign key constraint, which would otherwise
-- inflate coverage (>100%) and produce "Unknown Beach" entries in monitoring.
create or replace view public.v_enhanced_forecast_latest
with (security_invoker = true) as
select distinct on (e.beach_id)
  e.beach_id,
  e.updated_at,
  e.data_source
from public.enhanced_forecasts e
join public.beaches b on b.id = e.beach_id
where e.updated_at is not null
order by e.beach_id, e.updated_at desc;

grant select on public.v_enhanced_forecast_latest to service_role;

commit;

