begin;

create table if not exists public.buoys (
  buoy_uuid text primary key,
  buoy_name text,
  active boolean not null default true,
  coordinates geometry(Point, 4326),
  water_temperature numeric,
  air_temperature numeric,
  wave_height numeric,
  wave_period numeric,
  wind_speed numeric,
  wind_gust numeric,
  wind_direction numeric,
  tides jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_buoys_active on public.buoys(active);
create index if not exists idx_buoys_updated_at on public.buoys(updated_at desc);

alter table public.buoys enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'buoys_select_all') then
    create policy buoys_select_all on public.buoys for select using (true);
  end if;
end $$;

commit;


