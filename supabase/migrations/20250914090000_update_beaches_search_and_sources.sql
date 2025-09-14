-- Update beaches schema with slug, search indexes, and mapping tables
-- Also adds beach_sources and beach_calibration with RLS

begin;

-- Ensure required extensions
create extension if not exists postgis;
create extension if not exists pg_trgm;

-- Beaches: columns
alter table public.beaches
  add column if not exists slug text,
  add column if not exists region text,
  add column if not exists country text,
  add column if not exists lat double precision,
  add column if not exists lon double precision,
  add column if not exists lng double precision,
  add column if not exists popularity_score integer not null default 0,
  add column if not exists swell_window text,
  add column if not exists shore_aspect text,
  add column if not exists alt_names text[] not null default '{}',
  add column if not exists is_featured boolean not null default false;

-- Backfill lng from existing lon/longitude
do $$
begin
  if exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'beaches' and column_name = 'lng') then
    update public.beaches
    set lng = coalesce(lon, longitude)
    where lng is null and (lon is not null or longitude is not null);
  end if;
exception when undefined_column then
  -- Some environments may not have legacy longitude column; ignore
  null;
end$$;

-- Coordinates column (geography) for nearest queries
do $$
begin
  if not exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'beaches' and column_name = 'coordinates'
  ) then
    alter table public.beaches add column coordinates public.geography(Point,4326);
  end if;
end$$;

-- Backfill coordinates from available lat/lon fields
do $$
declare v_has_lat bool; v_has_latitude bool; v_has_lon bool; v_has_longitude bool; v_has_lng bool;
begin
  select exists(
    select 1 from information_schema.columns where table_schema='public' and table_name='beaches' and column_name='lat'
  ) into v_has_lat;
  select exists(
    select 1 from information_schema.columns where table_schema='public' and table_name='beaches' and column_name='latitude'
  ) into v_has_latitude;
  select exists(
    select 1 from information_schema.columns where table_schema='public' and table_name='beaches' and column_name='lon'
  ) into v_has_lon;
  select exists(
    select 1 from information_schema.columns where table_schema='public' and table_name='beaches' and column_name='longitude'
  ) into v_has_longitude;
  select exists(
    select 1 from information_schema.columns where table_schema='public' and table_name='beaches' and column_name='lng'
  ) into v_has_lng;

  if v_has_lat or v_has_latitude then
    update public.beaches
    set coordinates =
      st_setsrid(
        st_makepoint(
          case when v_has_lon and lon is not null then lon
               when v_has_longitude and longitude is not null then longitude
               when v_has_lng and lng is not null then lng
               else null end,
          case when v_has_lat and lat is not null then lat
               when v_has_latitude and latitude is not null then latitude
               else null end
        ), 4326
      )::public.geography
    where coordinates is null;
  end if;
end$$;

-- Keep coordinates in sync when numerical fields change
create or replace function public.set_beach_coordinates()
returns trigger language plpgsql as $$
begin
  new.coordinates := st_setsrid(
    st_makepoint(
      coalesce(new.lon, new.longitude, new.lng),
      coalesce(new.lat, new.latitude)
    ), 4326
  )::public.geography;
  return new;
end;
$$;

drop trigger if exists trg_set_beach_coordinates on public.beaches;
create trigger trg_set_beach_coordinates
before insert or update of lat, latitude, lon, longitude, lng on public.beaches
for each row execute function public.set_beach_coordinates();

-- Unique slug (case-insensitive), allow NULLs
create unique index if not exists beaches_slug_unique on public.beaches (lower(slug)) where slug is not null;

-- Spatial index for nearest queries
create index if not exists idx_beaches_coordinates_gist on public.beaches using gist (coordinates);

-- Trigram indexes for fuzzy search
create index if not exists idx_beaches_name_trgm on public.beaches using gin (lower(name) gin_trgm_ops);
create index if not exists idx_beaches_slug_trgm on public.beaches using gin (lower(slug) gin_trgm_ops);
-- Expression index over alt_names for fuzzy matching
-- Immutable wrapper for text[] → text to satisfy expression index immutability
create or replace function public.concat_text_array(vals text[])
returns text
language sql immutable as $$
  select array_to_string(vals, ' ');
$$;

create index if not exists idx_beaches_alt_names_trgm on public.beaches using gin ((public.concat_text_array(alt_names)) gin_trgm_ops);

-- Mapping table: beach_sources (one row per beach)
create table if not exists public.beach_sources (
  beach_id uuid primary key references public.beaches(id) on delete cascade,
  ndbc_buoy_ids text[] not null default '{}',
  forecast_source_id text,
  camera_url text,
  created_at timestamptz not null default now()
);
comment on table public.beach_sources is 'External source mappings per beach: NDBC buoy IDs, primary forecast source, camera URL';
create index if not exists idx_beach_sources_beach_id on public.beach_sources (beach_id);

-- RLS: read-only for public, writes via service role only
alter table public.beach_sources enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='beach_sources' and policyname='select_all'
  ) then
    create policy select_all on public.beach_sources for select using (true);
  end if;
end $$;

-- Mapping table: beach_calibration (one row per beach)
create table if not exists public.beach_calibration (
  beach_id uuid primary key references public.beaches(id) on delete cascade,
  tide_pref jsonb,
  swell_pref jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.beach_calibration is 'Spot-specific tuning preferences for tide and swell';
create unique index if not exists idx_beach_calibration_beach_id on public.beach_calibration (beach_id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists trg_beach_calibration_set_updated_at on public.beach_calibration;
create trigger trg_beach_calibration_set_updated_at
before update on public.beach_calibration
for each row execute function public.set_updated_at();

-- RLS: read-only for public
alter table public.beach_calibration enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='beach_calibration' and policyname='select_all'
  ) then
    create policy select_all on public.beach_calibration for select using (true);
  end if;
end $$;

commit;


