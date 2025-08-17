-- Enforce strict-radius coach picks: remove region shortcut and require distance <= _radius_km
-- Idempotent replacement of existing function signature

create or replace function public.get_coach_picks(
  _beach_id uuid,
  _radius_km numeric default 80
)
returns table (
  pick_rank int,
  beach_id uuid,
  name text,
  distance_km numeric,
  score int
) language sql stable as
$$
with origin as (
  select id, name, latitude as lat, longitude as lon
  from beaches where id = _beach_id
),
candidates as (
  select b.id, b.name, b.latitude, b.longitude,
         -- Haversine distance (km)
         6371 * 2 * asin(sqrt(
           pow(sin(radians(b.latitude - o.lat)/2),2) +
           cos(radians(o.lat))*cos(radians(b.latitude))*
           pow(sin(radians(b.longitude - o.lon)/2),2)
         )) as distance_km,
         coalesce(s.score_0_100, 0) as score
  from beaches b
  cross join origin o
  left join v_beach_hourly_scores s on s.beach_id = b.id
  where b.id <> _beach_id
)
select row_number() over(order by score desc nulls last, distance_km asc) as pick_rank,
       id as beach_id, name, distance_km, score
from candidates
where distance_km <= _radius_km
order by pick_rank
limit 3;
$$;

grant execute on function public.get_coach_picks(uuid, numeric) to anon, authenticated;

