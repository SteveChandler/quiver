-- Create normalized forecast tables for marine, tides, and sun times
-- RLS enabled with public SELECT; inserts will be done by service role

do $$ begin
  if to_regclass('public.beaches') is null then
    raise notice 'Skipping forecast tables creation: required table public.beaches does not exist';
    return;
  end if;

  create table if not exists public.marine_forecasts (
  id uuid primary key default gen_random_uuid(),
  beach_id uuid not null references public.beaches(id) on delete cascade,
  ts timestamptz not null,
  wave_height_m numeric,
  wave_period_s numeric,
  wave_direction_deg numeric,
  wind_speed_ms numeric,
  wind_direction_deg numeric,
  source text not null check (source in ('cdip','ndbc')),
  is_observed boolean not null default false,
  created_at timestamptz not null default now()
  );

  create index if not exists idx_marine_forecasts_beach_ts
    on public.marine_forecasts (beach_id, ts);

  alter table public.marine_forecasts enable row level security;
  if not exists (
    select 1 from pg_policies where policyname = 'marine_forecasts_select_all'
  ) then
    create policy marine_forecasts_select_all on public.marine_forecasts
      for select using (true);
  end if;

  create table if not exists public.tide_forecasts (
  id uuid primary key default gen_random_uuid(),
  beach_id uuid not null references public.beaches(id) on delete cascade,
  ts timestamptz not null,
  tide_height_m numeric,
  tide_phase text,
  source text not null check (source in ('noaa')),
  created_at timestamptz not null default now()
  );

  create index if not exists idx_tide_forecasts_beach_ts
    on public.tide_forecasts (beach_id, ts);

  alter table public.tide_forecasts enable row level security;
  if not exists (
    select 1 from pg_policies where policyname = 'tide_forecasts_select_all'
  ) then
    create policy tide_forecasts_select_all on public.tide_forecasts
      for select using (true);
  end if;

  create table if not exists public.sun_times (
  id uuid primary key default gen_random_uuid(),
  beach_id uuid not null references public.beaches(id) on delete cascade,
  date date not null,
  sunrise_utc timestamptz,
  sunset_utc timestamptz,
  source text not null check (source in ('computed')),
  created_at timestamptz not null default now()
  );

  create index if not exists idx_sun_times_beach_date
    on public.sun_times (beach_id, date);

  alter table public.sun_times enable row level security;
  if not exists (
    select 1 from pg_policies where policyname = 'sun_times_select_all'
  ) then
    create policy sun_times_select_all on public.sun_times
      for select using (true);
  end if;

end $$;


