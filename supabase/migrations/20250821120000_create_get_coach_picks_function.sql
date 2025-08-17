-- returns top 3 picks near the current beach (same region or within radius)
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
  select id, name, latitude as lat, longitude as lon, region_id
  from beaches where id = _beach_id
),
candidates as (
  select b.id, b.name, b.latitude, b.longitude, b.region_id,
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
    and (
      b.region_id = o.region_id
      or 6371 * 2 * asin(sqrt(
           pow(sin(radians(b.latitude - o.lat)/2),2) +
           cos(radians(o.lat))*cos(radians(b.latitude))*
           pow(sin(radians(b.longitude - o.lon)/2),2)
         )) <= _radius_km
    )
)
select row_number() over(order by score desc nulls last, distance_km asc) as pick_rank,
       id as beach_id, name, distance_km, score
from candidates
order by pick_rank
limit 3;
$$;

grant execute on function public.get_coach_picks(uuid, numeric) to anon, authenticated;

-- Indexes for performance
create index if not exists beaches_region_id_idx on beaches(region_id);
-- PostGIS optional: geometry index if geom exists
-- create index if not exists beaches_geom_gix on beaches using gist(geom);


