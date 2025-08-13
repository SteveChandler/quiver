-- Add missing core structures so later migrations don't skip
-- Positioned before 20250809000010_backfill_beach_preferences.sql

begin;

-- Ensure extensions required by types
create extension if not exists postgis;

-- Beaches: add columns used by seeds/backfills
do $$
begin
  if to_regclass('public.beaches') is null then
    create table public.beaches (
      id uuid primary key default gen_random_uuid(),
      name text not null
    );
  end if;

  -- Columns used by load scripts and backfills
  alter table public.beaches add column if not exists region text;
  alter table public.beaches add column if not exists country text;
  alter table public.beaches add column if not exists lat double precision;
  alter table public.beaches add column if not exists lon double precision;

  alter table public.beaches add column if not exists break_type text;
  alter table public.beaches add column if not exists hazards text[] default '{}'::text[];
  alter table public.beaches add column if not exists skill_level text;

  alter table public.beaches add column if not exists shoreline_aspect_deg smallint;
  alter table public.beaches add column if not exists swell_window_min_deg smallint;
  alter table public.beaches add column if not exists swell_window_max_deg smallint;
  alter table public.beaches add column if not exists wind_offshore_deg smallint;
  alter table public.beaches add column if not exists wind_offshore_tol_deg smallint default 30;
  alter table public.beaches add column if not exists wind_cross_shore_ok_kt smallint default 10;
  alter table public.beaches add column if not exists wind_onshore_bad_kt smallint default 8;
  alter table public.beaches add column if not exists preferred_tide_ft_min numeric;
  alter table public.beaches add column if not exists preferred_tide_ft_max numeric;
  alter table public.beaches add column if not exists preference_model jsonb;

  -- Geospatial coordinates column
  begin
    alter table public.beaches add column if not exists coordinates geography(Point,4326);
  exception when others then
    -- If PostGIS not available for any reason, skip coordinates
    raise notice 'Skipping coordinates column add: %', sqlerrm;
  end;
end $$;

-- Session invitations table (minimal)
do $$
begin
  if to_regclass('public.session_invitations') is null then
    create table public.session_invitations (
      id uuid primary key default gen_random_uuid(),
      session_id uuid not null,
      inviter_id uuid not null,
      invitee_id uuid,
      invitee_email text,
      status text not null default 'pending' check (status in ('pending','accepted','declined','revoked')),
      message text,
      created_at timestamptz default now(),
      responded_at timestamptz,
      idempotency_key text
    );
  end if;
end $$;

-- Beach recommendation calibration table (minimal)
do $$
begin
  if to_regclass('public.beach_recommendation_calibration') is null then
    create table public.beach_recommendation_calibration (
      id uuid primary key default gen_random_uuid(),
      beach_id uuid not null references public.beaches(id),
      window_start date not null,
      window_end date not null,
      samples_count integer not null default 0,
      best_swell_dir_deg_min smallint,
      best_swell_dir_deg_max smallint,
      best_wind_offshore_deg smallint,
      best_wind_tol_deg smallint,
      best_tide_ft_min numeric,
      best_tide_ft_max numeric,
      skill_level_inferred text,
      method text not null default 'default_seed',
      metrics jsonb,
      updated_at timestamptz not null default now()
    );
  end if;
end $$;

commit;


