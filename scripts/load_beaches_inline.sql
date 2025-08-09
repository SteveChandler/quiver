-- Supabase/Postgres loader for Surfline + Baja spots
-- Paste into Supabase SQL editor, or run via psql. This script:
-- * Ensures the table exists
-- * Adds country column if missing
-- * Loads JSON inline
-- * Keeps NEW coords when names duplicate (case-insensitive)
-- * Leaves one row per spot name

begin;

create table if not exists public.beaches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text,
  country text,
  -- Preferred coordinate columns used throughout the app and triggers
  latitude double precision,
  longitude double precision,
  -- Legacy/helper duplicates (kept for compatibility)
  lat double precision,
  lon double precision,
  -- PostGIS point for geospatial queries
  coordinates geography(POINT, 4326),
  -- Human-readable location string (DB may enforce NOT NULL)
  location text
);

-- Ensure all expected columns exist even if the table predated this script
alter table public.beaches
  add column if not exists region text,
  add column if not exists country text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists lat double precision,
  add column if not exists lon double precision,
  add column if not exists coordinates geography(POINT, 4326),
  add column if not exists location text;

drop table if exists temp_beaches;
create temporary table temp_beaches (
  name text primary key,
  region text,
  country text,
  lat double precision,
  lon double precision
) on commit drop;

with raw as (
  select
    $json$
[
  {
    "name": "Huntington Beach Pier Southside",
    "region": "Huntington Beach, CA",
    "country": "USA",
    "lat": 33.6542,
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
    "name": "Lower Trestles",
    "region": "San Onofre, CA",
    "country": "USA",
    "lat": 33.3844,
    "lon": -117.5934
  },
  {
    "name": "Church",
    "region": "San Onofre, CA",
    "country": "USA",
    "lat": 33.3847,
    "lon": -117.5697
  },
  {
    "name": "Huntington Beach Pier Northside",
    "region": "Huntington Beach, CA",
    "country": "USA",
    "lat": 33.6552,
    "lon": -118.0022
  },
  {
    "name": "Cottons",
    "region": "San Onofre, CA",
    "country": "USA",
    "lat": 33.4021,
    "lon": -117.6136
  },
  {
    "name": "Middles",
    "region": "San Onofre, CA",
    "country": "USA",
    "lat": 33.3897,
    "lon": -117.5987
  },
  {
    "name": "K-38",
    "region": "Baja California",
    "country": "Mexico",
    "lat": 32.2162,
    "lon": -116.9238
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
    "name": "Newport Upper Jetties",
    "region": "Newport Beach, CA",
    "country": "USA",
    "lat": 33.6057,
    "lon": -117.9308
  },
  {
    "name": "Strands",
    "region": "Dana Point, CA",
    "country": "USA",
    "lat": 33.4663,
    "lon": -117.7166
  },
  {
    "name": "204s",
    "region": "San Clemente, CA",
    "country": "USA",
    "lat": 33.4493,
    "lon": -117.6337
  },
  {
    "name": "T-Street",
    "region": "San Clemente, CA",
    "country": "USA",
    "lat": 33.4209,
    "lon": -117.6241
  },
  {
    "name": "Upper Trestles",
    "region": "San Onofre, CA",
    "country": "USA",
    "lat": 33.3927,
    "lon": -117.6015
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
    "name": "Cardiff Reef",
    "region": "Cardiff-by-the-Sea, CA",
    "country": "USA",
    "lat": 33.0202,
    "lon": -117.279
  },
  {
    "name": "Scripps",
    "region": "La Jolla, San Diego, CA",
    "country": "USA",
    "lat": 32.867,
    "lon": -117.2573
  },
  {
    "name": "Windansea",
    "region": "La Jolla, San Diego, CA",
    "country": "USA",
    "lat": 32.8299,
    "lon": -117.2823
  },
  {
    "name": "Ocean Beach",
    "region": "San Diego, CA",
    "country": "USA",
    "lat": 32.7493,
    "lon": -117.2511
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
    "name": "Tamarack",
    "region": "Carlsbad, CA",
    "country": "USA",
    "lat": 33.1553,
    "lon": -117.3568
  },
  {
    "name": "Beacons",
    "region": "Encinitas, CA",
    "country": "USA",
    "lat": 33.0744,
    "lon": -117.3146
  },
  {
    "name": "La Jolla Shores",
    "region": "La Jolla, San Diego, CA",
    "country": "USA",
    "lat": 32.8574,
    "lon": -117.2568
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
    "name": "K-40 (Puerto Nuevo)",
    "region": "Baja California",
    "country": "Mexico",
    "lat": 32.2041,
    "lon": -116.9093
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
    "name": "River Jetties",
    "region": "Newport Beach, CA",
    "country": "USA",
    "lat": 33.6284,
    "lon": -117.9533
  },
  {
    "name": "Poche Beach",
    "region": "San Clemente, CA",
    "country": "USA",
    "lat": 33.462,
    "lon": -117.6668
  },
  {
    "name": "San Clemente Pier, Northside",
    "region": "San Clemente, CA",
    "country": "USA",
    "lat": 33.4218,
    "lon": -117.6223
  },
  {
    "name": "Oceanside Harbor",
    "region": "Oceanside, CA",
    "country": "USA",
    "lat": 33.2051,
    "lon": -117.3922
  },
  {
    "name": "Ponto",
    "region": "Carlsbad, CA",
    "country": "USA",
    "lat": 33.0862,
    "lon": -117.3074
  },
  {
    "name": "George's",
    "region": "Cardiff-by-the-Sea, CA",
    "country": "USA",
    "lat": 33.0039,
    "lon": -117.2778
  },
  {
    "name": "Seaside Reef",
    "region": "Solana Beach, CA",
    "country": "USA",
    "lat": 33.0009,
    "lon": -117.2726
  },
  {
    "name": "Del Mar Rivermouth",
    "region": "Del Mar, CA",
    "country": "USA",
    "lat": 32.9628,
    "lon": -117.2694
  },
  {
    "name": "Torrey Pines State Beach",
    "region": "San Diego, CA",
    "country": "USA",
    "lat": 32.9255,
    "lon": -117.2609
  },
  {
    "name": "Imperial Beach Pier",
    "region": "Imperial Beach, CA",
    "country": "USA",
    "lat": 32.5794,
    "lon": -117.1341
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
    "name": "Oceanside Pier",
    "region": "Oceanside, CA",
    "country": "USA",
    "lat": 33.1923,
    "lon": -117.3823
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
    "name": "Grandview",
    "region": "Encinitas, CA",
    "country": "USA",
    "lat": 33.0806,
    "lon": -117.3143
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
    "name": "Solana Beach",
    "region": "Solana Beach, CA",
    "country": "USA",
    "lat": 32.9914,
    "lon": -117.2711
  },
  {
    "name": "Del Mar",
    "region": "Del Mar, CA",
    "country": "USA",
    "lat": 32.9597,
    "lon": -117.2652
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

-- Build a deduplicated set that prefers NEW rows from temp_beaches over existing rows
drop table if exists temp_beaches_deduped;
create temporary table temp_beaches_deduped on commit drop as
with unioned as (
  select
    lower(tb.name) as key,
    tb.name,
    tb.region,
    tb.country,
    tb.lat,
    tb.lon,
    null::double precision as latitude,
    null::double precision as longitude,
    1 as priority
  from temp_beaches tb
  union all
  select
    lower(b.name) as key,
    b.name,
    b.region,
    b.country,
    b.lat,
    b.lon,
    b.latitude,
    b.longitude,
    2 as priority
  from public.beaches b
)
select
  (array_agg(name   order by priority))[1] as name,
  (array_agg(region order by priority))[1] as region,
  (array_agg(country order by priority))[1] as country,
  (array_agg(coalesce(lat, latitude) order by priority))[1] as lat,
  (array_agg(coalesce(lon, longitude) order by priority))[1] as lon,
  (array_agg(coalesce(lat, latitude) order by priority))[1] as latitude,
  (array_agg(coalesce(lon, longitude) order by priority))[1] as longitude
from unioned
group by key;

-- Ensure CI unique index exists for ON CONFLICT index inference
create unique index if not exists beaches_name_unique_ci
  on public.beaches (lower(name));

-- 1) Update existing rows matched case-insensitively by name
update public.beaches b
set
  name = t.name,
  region = t.region,
  country = t.country,
  lat = t.lat,
  lon = t.lon,
  latitude = t.latitude,
  longitude = t.longitude,
  coordinates = CASE
    WHEN t.latitude IS NOT NULL AND t.longitude IS NOT NULL
      THEN ST_Point(t.longitude, t.latitude)::geography
    ELSE b.coordinates
  END,
  location = COALESCE(t.region, b.location, format('%.6f, %.6f', t.latitude, t.longitude))
from temp_beaches_deduped t
where lower(b.name) = lower(t.name);

-- 2) Insert new rows that don't exist yet (case-insensitive)
insert into public.beaches (
  name, region, country, lat, lon, latitude, longitude, coordinates,
  location
)
select
  t.name, t.region, t.country, t.lat, t.lon, t.latitude, t.longitude,
  CASE WHEN t.latitude IS NOT NULL AND t.longitude IS NOT NULL
       THEN ST_Point(t.longitude, t.latitude)::geography
       ELSE NULL
  END,
  COALESCE(t.region, format('%.6f, %.6f', t.latitude, t.longitude))
from temp_beaches_deduped t
where not exists (
  select 1 from public.beaches b where lower(b.name) = lower(t.name)
);

commit;
