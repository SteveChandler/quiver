-- Supabase/Postgres loader + enrichments for Surfline/Baja spots

drop table if exists temp_beaches cascade;
create temporary table temp_beaches (
  name text primary key,
  region text,
  country text,
  lat double precision,
  lon double precision
) on commit drop;

with raw as (
  select $json$
[
  {
    "name": "Huntington Beach Pier Southside",
    "region": "Huntington Beach, CA",
    "country": "USA",
    "lat": 33.6542,
    "lon": -118.0022
  },
  {
    "name": "Huntington Beach Pier Northside",
    "region": "Huntington Beach, CA",
    "country": "USA",
    "lat": 33.6552,
    "lon": -118.0022
  },
  {
    "name": "The Wedge",
    "region": "Newport Beach, CA",
    "country": "USA",
    "lat": 33.5939,
    "lon": -117.8776
  },
  {
    "name": "North HB Streets",
    "region": "Huntington Beach, CA",
    "country": "USA",
    "lat": 33.6805,
    "lon": -118.0113
  },
  {
    "name": "Huntington St.",
    "region": "Huntington Beach, CA",
    "country": "USA",
    "lat": 33.6514,
    "lon": -118.0067
  },
  {
    "name": "River Jetties",
    "region": "Newport Beach, CA",
    "country": "USA",
    "lat": 33.6284,
    "lon": -117.9533
  },
  {
    "name": "Newport Upper Jetties",
    "region": "Newport Beach, CA",
    "country": "USA",
    "lat": 33.6057,
    "lon": -117.9308
  },
  {
    "name": "Newport Lower Jetties",
    "region": "Newport Beach, CA",
    "country": "USA",
    "lat": 33.5953,
    "lon": -117.9009
  },
  {
    "name": "Newport Point",
    "region": "Newport Beach, CA",
    "country": "USA",
    "lat": 33.5955,
    "lon": -117.9
  },
  {
    "name": "HB Cliffs",
    "region": "Huntington Beach, CA",
    "country": "USA",
    "lat": 33.6908,
    "lon": -118.0451
  },
  {
    "name": "Huntington State Beach",
    "region": "Huntington Beach, CA",
    "country": "USA",
    "lat": 33.6418,
    "lon": -117.9739
  },
  {
    "name": "Corona del Mar",
    "region": "Newport Beach, CA",
    "country": "USA",
    "lat": 33.5917,
    "lon": -117.8734
  },
  {
    "name": "Crystal Cove",
    "region": "Newport Coast, CA",
    "country": "USA",
    "lat": 33.5741,
    "lon": -117.8235
  },
  {
    "name": "Thalia Street",
    "region": "Laguna Beach, CA",
    "country": "USA",
    "lat": 33.5351,
    "lon": -117.7735
  },
  {
    "name": "Brooks Street",
    "region": "Laguna Beach, CA",
    "country": "USA",
    "lat": 33.5332,
    "lon": -117.7715
  },
  {
    "name": "Agate Street",
    "region": "Laguna Beach, CA",
    "country": "USA",
    "lat": 33.5291,
    "lon": -117.7684
  },
  {
    "name": "Rockpile",
    "region": "Laguna Beach, CA",
    "country": "USA",
    "lat": 33.545,
    "lon": -117.7906
  },
  {
    "name": "Salt Creek",
    "region": "Dana Point, CA",
    "country": "USA",
    "lat": 33.4728,
    "lon": -117.7173
  },
  {
    "name": "Strands",
    "region": "Dana Point, CA",
    "country": "USA",
    "lat": 33.4663,
    "lon": -117.7166
  },
  {
    "name": "Doheny State Beach",
    "region": "Dana Point, CA",
    "country": "USA",
    "lat": 33.4606,
    "lon": -117.6889
  },
  {
    "name": "San Clemente State Beach",
    "region": "San Clemente, CA",
    "country": "USA",
    "lat": 33.4025,
    "lon": -117.6065
  },
  {
    "name": "T-Street",
    "region": "San Clemente, CA",
    "country": "USA",
    "lat": 33.4209,
    "lon": -117.6241
  },
  {
    "name": "San Clemente Pier, Northside",
    "region": "San Clemente, CA",
    "country": "USA",
    "lat": 33.4218,
    "lon": -117.6223
  },
  {
    "name": "204s",
    "region": "San Clemente, CA",
    "country": "USA",
    "lat": 33.4493,
    "lon": -117.6337
  },
  {
    "name": "Poche Beach",
    "region": "San Clemente, CA",
    "country": "USA",
    "lat": 33.462,
    "lon": -117.6668
  },
  {
    "name": "Upper Trestles",
    "region": "San Onofre, CA",
    "country": "USA",
    "lat": 33.3927,
    "lon": -117.6015
  },
  {
    "name": "Lower Trestles",
    "region": "San Onofre, CA",
    "country": "USA",
    "lat": 33.3844,
    "lon": -117.5934
  },
  {
    "name": "Middles",
    "region": "San Onofre, CA",
    "country": "USA",
    "lat": 33.3897,
    "lon": -117.5987
  },
  {
    "name": "Cottons",
    "region": "San Onofre, CA",
    "country": "USA",
    "lat": 33.4021,
    "lon": -117.6136
  },
  {
    "name": "Church",
    "region": "San Onofre, CA",
    "country": "USA",
    "lat": 33.3847,
    "lon": -117.5697
  },
  {
    "name": "San Onofre State Beach",
    "region": "San Onofre, CA",
    "country": "USA",
    "lat": 33.3682,
    "lon": -117.569
  },
  {
    "name": "Trails",
    "region": "San Onofre, CA",
    "country": "USA",
    "lat": 33.3566,
    "lon": -117.5696
  },
  {
    "name": "El Morro Point (K37.5)",
    "region": "Baja California",
    "country": "Mexico",
    "lat": 32.229,
    "lon": -116.944
  },
  {
    "name": "Las Gaviotas",
    "region": "Baja California",
    "country": "Mexico",
    "lat": 32.2472,
    "lon": -116.9695
  },
  {
    "name": "K-38",
    "region": "Baja California",
    "country": "Mexico",
    "lat": 32.2162,
    "lon": -116.9238
  },
  {
    "name": "K-40 (Puerto Nuevo)",
    "region": "Baja California",
    "country": "Mexico",
    "lat": 32.2041,
    "lon": -116.9093
  },
  {
    "name": "Rosarito Beach",
    "region": "Baja California",
    "country": "Mexico",
    "lat": 32.3573,
    "lon": -117.0553
  },
  {
    "name": "Renes",
    "region": "Baja California",
    "country": "Mexico",
    "lat": 32.2323,
    "lon": -116.9404
  },
  {
    "name": "Alfonsos",
    "region": "Baja California",
    "country": "Mexico",
    "lat": 32.2238,
    "lon": -116.9301
  },
  {
    "name": "Teresa's",
    "region": "Baja California",
    "country": "Mexico",
    "lat": 32.2192,
    "lon": -116.9258
  },
  {
    "name": "Oceanside Harbor",
    "region": "Oceanside, CA",
    "country": "USA",
    "lat": 33.2051,
    "lon": -117.3922
  },
  {
    "name": "Oceanside Pier",
    "region": "Oceanside, CA",
    "country": "USA",
    "lat": 33.1923,
    "lon": -117.3823
  },
  {
    "name": "The Rock, Oceanside",
    "region": "Oceanside, CA",
    "country": "USA",
    "lat": 33.1958,
    "lon": -117.3869
  },
  {
    "name": "Forster St. Oceanside",
    "region": "Oceanside, CA",
    "country": "USA",
    "lat": 33.186,
    "lon": -117.3706
  },
  {
    "name": "Tamarack",
    "region": "Carlsbad, CA",
    "country": "USA",
    "lat": 33.1553,
    "lon": -117.3568
  },
  {
    "name": "Carlsbad State Beach",
    "region": "Carlsbad, CA",
    "country": "USA",
    "lat": 33.1571,
    "lon": -117.3525
  },
  {
    "name": "Terramar Point",
    "region": "Carlsbad, CA",
    "country": "USA",
    "lat": 33.1411,
    "lon": -117.343
  },
  {
    "name": "Ponto",
    "region": "Carlsbad, CA",
    "country": "USA",
    "lat": 33.0862,
    "lon": -117.3074
  },
  {
    "name": "Grandview",
    "region": "Encinitas, CA",
    "country": "USA",
    "lat": 33.0806,
    "lon": -117.3143
  },
  {
    "name": "Beacons",
    "region": "Encinitas, CA",
    "country": "USA",
    "lat": 33.0744,
    "lon": -117.3146
  },
  {
    "name": "Moonlight State Beach",
    "region": "Encinitas, CA",
    "country": "USA",
    "lat": 33.0469,
    "lon": -117.2937
  },
  {
    "name": "D Street",
    "region": "Encinitas, CA",
    "country": "USA",
    "lat": 33.0451,
    "lon": -117.2929
  },
  {
    "name": "Pipes",
    "region": "Cardiff-by-the-Sea, CA",
    "country": "USA",
    "lat": 33.0257,
    "lon": -117.2816
  },
  {
    "name": "San Elijo State Beach",
    "region": "Cardiff-by-the-Sea, CA",
    "country": "USA",
    "lat": 33.0238,
    "lon": -117.2798
  },
  {
    "name": "Cardiff Reef",
    "region": "Cardiff-by-the-Sea, CA",
    "country": "USA",
    "lat": 33.0202,
    "lon": -117.279
  },
  {
    "name": "Seaside Reef",
    "region": "Solana Beach, CA",
    "country": "USA",
    "lat": 33.0009,
    "lon": -117.2726
  },
  {
    "name": "George's",
    "region": "Cardiff-by-the-Sea, CA",
    "country": "USA",
    "lat": 33.0039,
    "lon": -117.2778
  },
  {
    "name": "Del Mar Rivermouth",
    "region": "Del Mar, CA",
    "country": "USA",
    "lat": 32.9628,
    "lon": -117.2694
  },
  {
    "name": "Del Mar",
    "region": "Del Mar, CA",
    "country": "USA",
    "lat": 32.9597,
    "lon": -117.2652
  },
  {
    "name": "Solana Beach",
    "region": "Solana Beach, CA",
    "country": "USA",
    "lat": 32.9914,
    "lon": -117.2711
  },
  {
    "name": "Torrey Pines State Beach",
    "region": "San Diego, CA",
    "country": "USA",
    "lat": 32.9255,
    "lon": -117.2609
  },
  {
    "name": "Scripps",
    "region": "La Jolla, San Diego, CA",
    "country": "USA",
    "lat": 32.867,
    "lon": -117.2573
  },
  {
    "name": "La Jolla Shores",
    "region": "La Jolla, San Diego, CA",
    "country": "USA",
    "lat": 32.8574,
    "lon": -117.2568
  },
  {
    "name": "Blacks",
    "region": "La Jolla, San Diego, CA",
    "country": "USA",
    "lat": 32.8892,
    "lon": -117.2549
  },
  {
    "name": "Horseshoe",
    "region": "La Jolla, San Diego, CA",
    "country": "USA",
    "lat": 32.8269,
    "lon": -117.2826
  },
  {
    "name": "Windansea",
    "region": "La Jolla, San Diego, CA",
    "country": "USA",
    "lat": 32.8299,
    "lon": -117.2823
  },
  {
    "name": "Birdrock",
    "region": "La Jolla, San Diego, CA",
    "country": "USA",
    "lat": 32.8047,
    "lon": -117.2713
  },
  {
    "name": "PB Point",
    "region": "Pacific Beach, San Diego, CA",
    "country": "USA",
    "lat": 32.7998,
    "lon": -117.2623
  },
  {
    "name": "Pacific Beach",
    "region": "Pacific Beach, San Diego, CA",
    "country": "USA",
    "lat": 32.7979,
    "lon": -117.255
  },
  {
    "name": "Mission Beach",
    "region": "San Diego, CA",
    "country": "USA",
    "lat": 32.7702,
    "lon": -117.2525
  },
  {
    "name": "Ocean Beach",
    "region": "San Diego, CA",
    "country": "USA",
    "lat": 32.7493,
    "lon": -117.2511
  },
  {
    "name": "Imperial Beach Pier",
    "region": "Imperial Beach, CA",
    "country": "USA",
    "lat": 32.5794,
    "lon": -117.1341
  }
]
$json$::jsonb as j
),
parsed as (
  select *
  from jsonb_to_recordset((select j from raw))
    as x(
      name text,
      region text,
      country text,
      lat double precision,
      lon double precision
    )
)
insert into temp_beaches (name, region, country, lat, lon)
select name, region, country, lat, lon
from parsed;

begin;

with enriched as (
  select
    tb.name,
    tb.region,
    tb.country,
    tb.lat,
    tb.lon,
    case
      when tb.name ilike '%Reef%' then 'reef'
      when tb.name ilike '%Point%' then 'point'
      when tb.name ilike '%Jetty%' or tb.name ilike '%Jetti%' or tb.name ilike '%Pier%' or tb.name ilike '%Harbor%' then 'jetty'
      else 'beach'
    end as break_type,
    (
      select array(
        select distinct unnest(
          array_cat(
            array_cat(
              case when (tb.name ilike '%Reef%' or tb.name ilike '%Point%' or tb.name ilike '%Rock%' or tb.name ilike '%Cliff%'
                         or tb.name ilike '%Rockpile%' or tb.name ilike '%Windansea%' or tb.name ilike '%Birdrock%' or tb.name ilike '%Horseshoe%'
                         or tb.name ilike '%PB Point%' or tb.name ilike '%Blacks%')
                   then array['rocks']::text[] else array[]::text[] end,
              case when (tb.name ilike '%Pier%' or tb.name ilike '%Jetti%' or tb.name ilike '%Jetty%' or tb.name ilike '%Harbor%'
                         or tb.name ilike '%Blacks%')
                   then array['rips','shorebreak']::text[] else array[]::text[] end
            ),
            array[]::text[]
          )
        )
      )
    ) as hazards,
    case
      when tb.region ilike '%Baja%' then 310
      when tb.region ilike '%San Onofre%' or tb.name ilike '%Trestles%' or tb.region ilike '%San Clemente%' then 340
      when tb.region ilike '%Huntington Beach%' or tb.region ilike '%Newport%' or tb.region ilike '%Laguna%' or tb.region ilike '%Dana Point%' then 330
      else 320
    end as shoreline_aspect_deg,
    30 as wind_offshore_tol_deg,
    10 as wind_cross_shore_ok_kt,
    8 as wind_onshore_bad_kt
  from temp_beaches tb
),
with_params as (
  select
    e.*,
    case when e.break_type = 'beach' then 70 else 45 end as swell_half_width
  from enriched e
),
computed as (
  select
    p.*,
    ((p.shoreline_aspect_deg - p.swell_half_width + 360) % 360) as swell_window_min_deg,
    ((p.shoreline_aspect_deg + p.swell_half_width) % 360)         as swell_window_max_deg,
    ((p.shoreline_aspect_deg + 180) % 360)                        as wind_offshore_deg,
    case when p.break_type = 'beach' then 1.0 else 2.0 end as preferred_tide_ft_min,
    case when p.break_type = 'beach' then 3.0 else 5.0 end as preferred_tide_ft_max,
    case
      when p.break_type = 'beach' then 'Beginner–Intermediate'
      when p.break_type = 'point' then 'Intermediate'
      else 'Intermediate–Advanced'
    end as base_skill
  from with_params p
),
finalized as (
  select
    c.name, c.region, c.country, c.lat, c.lon,
    c.break_type, c.hazards,
    c.shoreline_aspect_deg, c.swell_window_min_deg, c.swell_window_max_deg,
    c.wind_offshore_deg, c.wind_offshore_tol_deg, c.wind_cross_shore_ok_kt, c.wind_onshore_bad_kt,
    c.preferred_tide_ft_min, c.preferred_tide_ft_max,
    case
      when array_length(c.hazards,1) is not null and array_length(c.hazards,1) > 0 then
        case c.base_skill
          when 'Beginner–Intermediate' then 'Intermediate'
          when 'Intermediate' then 'Advanced'
          else 'Advanced'
        end
      else c.base_skill
    end as skill_level
  from computed c
),
unioned as (
  select lower(f.name) as key, f.*, 1 as priority from finalized f
),
deduped as (
  select distinct on (key)
         name, region, country, lat, lon,
         break_type, hazards,
         shoreline_aspect_deg, swell_window_min_deg, swell_window_max_deg,
         wind_offshore_deg, wind_offshore_tol_deg, wind_cross_shore_ok_kt, wind_onshore_bad_kt,
         preferred_tide_ft_min, preferred_tide_ft_max,
         skill_level
  from unioned
  order by key, priority
),
updated as (
  update public.beaches as b
  set
    location = COALESCE(s.region, format('%.6f, %.6f', s.lat, s.lon)),
    latitude = s.lat,
    longitude = s.lon,
    description = COALESCE(s.region, s.name)
  from (
    select
      name, region, country, lat, lon
    from deduped
    where lat is not null and lon is not null
      and lat between -90 and 90 and lon between -180 and 180
      and lower(name) <> '204s'
  ) as s
  where lower(b.name) = lower(s.name)
  returning 1
)
insert into public.beaches (name, location, latitude, longitude, description)
select
  s.name,
  COALESCE(s.region, format('%.6f, %.6f', s.lat, s.lon)) as location,
  s.lat as latitude,
  s.lon as longitude,
  COALESCE(s.region, s.name) as description
from (
  select
    name, region, country, lat, lon
  from deduped
  where lat is not null and lon is not null
    and lat between -90 and 90 and lon between -180 and 180
    and lower(name) <> '204s'
) as s
where not exists (
  select 1 from public.beaches b where lower(b.name) = lower(s.name)
);
commit;

create unique index if not exists beaches_name_unique_ci on public.beaches (lower(name));
