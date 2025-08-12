-- Create RPC to return top 2-hour windows for a beach

begin;

drop function if exists public.get_best_times(uuid, timestamptz, timestamptz, int);

create or replace function public.get_best_times(
  p_beach uuid,
  p_start timestamptz,
  p_end   timestamptz,
  p_limit int default 6
)
returns table (
  start_ts timestamptz,
  end_ts   timestamptz,
  label    text,
  score    int
)
language sql
stable
as $$
with hrs as (
  select ts_utc, score_0_100
  from public.v_beach_hourly_scores
  where beach_id = p_beach
    and ts_utc >= p_start
    and ts_utc <= p_end
),
win as (
  select
    h1.ts_utc                       as start_ts,
    h1.ts_utc + interval '2 hour'   as end_ts,
    round(avg(h2.score_0_100))::int as score
  from hrs h1
  join hrs h2
    on h2.ts_utc between h1.ts_utc and h1.ts_utc + interval '1 hour'
  group by h1.ts_utc
),
ranked as (
  select
    w.*,
    case
      when w.score >= 85 then 'epic'
      when w.score >= 70 then 'good'
      when w.score >= 55 then 'fair'
      else 'poor'
    end as grade
  from win w
  where w.score >= 55
),
dedup as (
  select r.*,
         row_number() over (
           order by r.score desc, r.start_ts
         ) as rn
  from ranked r
)
select
  d.start_ts,
  d.end_ts,
  d.grade || ' (' || d.score || ')' as label,
  d.score
from dedup d
order by d.score desc, d.start_ts
limit p_limit;
$$;

grant execute on function public.get_best_times(uuid, timestamptz, timestamptz, int) to anon, authenticated, service_role;

commit;
