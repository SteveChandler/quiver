begin;

-- Create enhanced_forecasts table (normalized fields match generator writes)
create table if not exists public.enhanced_forecasts (
  id uuid primary key default gen_random_uuid(),
  beach_id uuid not null references public.beaches(id) on delete cascade,
  forecast_date date not null,
  forecast_time time not null,

  wave_height text,
  wave_period text,
  wave_direction text,

  swell_1_height text,
  swell_1_period text,
  swell_1_direction text,
  swell_2_height text,
  swell_2_period text,
  swell_2_direction text,

  wind_wave_height text,
  wind_wave_period text,
  wind_wave_direction text,

  water_temp text,
  air_temperature text,
  wind_speed text,
  wind_direction text,
  weather_condition text,

  tide_status text,
  tide_height text,
  next_tide_time text,
  next_tide_type text,
  next_tide_height text,

  confidence_score integer not null default 50,
  data_source text,

  raw_forecast jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint enhanced_forecasts_unique unique (beach_id, forecast_date, forecast_time)
);

create index if not exists idx_enhanced_forecasts_beach_date_time
  on public.enhanced_forecasts (beach_id, forecast_date, forecast_time);

alter table public.enhanced_forecasts enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where policyname = 'enhanced_forecasts_select_all'
  ) then
    create policy enhanced_forecasts_select_all on public.enhanced_forecasts
      for select using (true);
  end if;
end $$;

create or replace view public.ten_day_enhanced_forecasts
with (security_invoker = true) as
select * from public.enhanced_forecasts
where forecast_date >= current_date
  and forecast_date <= current_date + interval '10 days'
order by beach_id, forecast_date, forecast_time;

commit;


