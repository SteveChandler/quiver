begin;

-- The first near-term selector could still choose a passed forecast slot from
-- local today. Once that slot expired, refreshes kept selecting the same old
-- row and the stale queue never drained. Only current/future slots can power
-- the public answer or freshness selector.
create or replace view public.v_enhanced_forecast_latest
with (security_invoker = true) as
select
  b.id as beach_id,
  near_term.updated_at,
  near_term.data_source
from public.beaches b
cross join lateral (
  select
    ef.updated_at,
    ef.data_source
  from public.enhanced_forecasts ef
  where ef.beach_id = b.id
    and ef.forecast_at >= now()
    and ef.forecast_at < now() + interval '72 hours'
    and ef.updated_at is not null
    and nullif(btrim(ef.wave_height), '') is not null
    and nullif(btrim(ef.data_source), '') is not null
  order by
    case
      when (ef.forecast_at at time zone coalesce(nullif(b.timezone, ''), 'America/Los_Angeles'))::date =
        (now() at time zone coalesce(nullif(b.timezone, ''), 'America/Los_Angeles'))::date
        then 0
      when (ef.forecast_at at time zone coalesce(nullif(b.timezone, ''), 'America/Los_Angeles'))::date =
        ((now() at time zone coalesce(nullif(b.timezone, ''), 'America/Los_Angeles'))::date + 1)
        then 1
      else 2
    end,
    ef.forecast_at asc,
    ef.updated_at desc
  limit 1
) near_term;

grant select on public.v_enhanced_forecast_latest to service_role;

commit;
