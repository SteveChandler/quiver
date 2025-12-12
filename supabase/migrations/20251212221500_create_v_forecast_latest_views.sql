begin;

-- Latest marine forecast row per beach (1 row per beach).
-- Uses security_invoker so underlying table RLS applies for the querying role.
create or replace view public.v_marine_forecast_latest
with (security_invoker = true) as
select distinct on (m.beach_id)
  m.beach_id,
  m.created_at,
  m.ts,
  m.source,
  m.is_observed
from public.marine_forecasts m
join public.beaches b on b.id = m.beach_id
where m.beach_id is not null
-- Prefer observed rows over persistence projections.
order by m.beach_id, m.is_observed desc, m.created_at desc, m.ts desc;

-- Latest tide forecast row per beach (1 row per beach).
create or replace view public.v_tide_forecast_latest
with (security_invoker = true) as
select distinct on (t.beach_id)
  t.beach_id,
  t.created_at,
  t.ts,
  t.source
from public.tide_forecasts t
join public.beaches b on b.id = t.beach_id
where t.beach_id is not null
order by t.beach_id, t.created_at desc, t.ts desc;

-- Latest sun_times row per beach (1 row per beach).
create or replace view public.v_sun_times_latest
with (security_invoker = true) as
select distinct on (s.beach_id)
  s.beach_id,
  s.created_at,
  s.date,
  s.source
from public.sun_times s
join public.beaches b on b.id = s.beach_id
where s.beach_id is not null
order by s.beach_id, s.created_at desc, s.date desc;

grant select on public.v_marine_forecast_latest to service_role;
grant select on public.v_tide_forecast_latest to service_role;
grant select on public.v_sun_times_latest to service_role;

commit;

