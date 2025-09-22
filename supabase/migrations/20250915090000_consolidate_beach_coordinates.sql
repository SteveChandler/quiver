-- Consolidate beach coordinate columns: keep latitude/longitude + coordinates
-- Drop legacy lat/lon/lng and update trigger to sync from latitude/longitude only

begin;

-- Ensure PostGIS
create extension if not exists postgis;

-- Backfill numeric latitude/longitude from legacy columns where missing
do $$
begin
  if exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'beaches' and column_name = 'lat'
  ) then
    update public.beaches
    set latitude = coalesce(latitude, lat)
    where latitude is null and lat is not null;
  end if;

  if exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'beaches' and column_name in ('lon','lng')
  ) then
    update public.beaches
    set longitude = coalesce(longitude, lon, lng)
    where longitude is null and (lon is not null or lng is not null);
  end if;
exception when undefined_column then
  null;
end$$;

-- Ensure coordinates column exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'beaches' and column_name = 'coordinates'
  ) then
    alter table public.beaches add column coordinates public.geography(Point,4326);
  end if;
end$$;

-- Backfill coordinates from latitude/longitude
update public.beaches
set coordinates = st_setsrid(st_makepoint(longitude, latitude), 4326)::public.geography
where coordinates is null and latitude is not null and longitude is not null;

-- Trigger to keep coordinates in sync from latitude/longitude only
create or replace function public.set_beach_coordinates()
returns trigger language plpgsql as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.coordinates := st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::public.geography;
  else
    new.coordinates := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_beach_coordinates on public.beaches;
create trigger trg_set_beach_coordinates
before insert or update of latitude, longitude on public.beaches
for each row execute function public.set_beach_coordinates();

-- Drop legacy duplicate columns if present
alter table public.beaches drop column if exists lat;
alter table public.beaches drop column if exists lon;
alter table public.beaches drop column if exists lng;

commit;


