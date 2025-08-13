-- Consolidate community reports and standardize hourly conditions layer
-- - condition_reports: merges check_ins + intel_posts (two kinds)
-- - hourly_conditions_mv + hourly_conditions_ui: numeric-first storage with UI formatting in a view
-- - materialized stats: beach_stats_mv, storage_usage_mv
-- - constraints, indexes, cascades, RLS, and safety helpers

-- =========================
-- 0) Extensions (safe)
-- =========================
create extension if not exists pgcrypto;     -- gen_random_uuid()
create extension if not exists btree_gist;   -- exclusion constraints
create extension if not exists postgis;      -- geography() and helpers

-- =========================
-- 1) Helper functions (idempotent)
-- =========================

-- first_number(text) → numeric: extract first number from string
do $$ begin
  if not exists (
    select 1 from pg_proc where proname = 'first_number' and pg_function_is_visible(oid)
  ) then
    create or replace function public.first_number(txt text) returns numeric
    language sql immutable as $$
      select case
        when $1 is null then null
        else (
          select (m).match[1]::numeric
          from regexp_matches($1, '(-?\d+(\.\d+)?)', 'g') as m
          limit 1
        )
      end
    $$;
    comment on function public.first_number(text) is 'Extract first numeric literal from a string; returns NULL if none.';
  end if;
end $$;

-- cardinal_to_deg(text) → smallint (ensure exists)
do $$ begin
  if not exists (
    select 1 from pg_proc where proname = 'cardinal_to_deg' and pg_function_is_visible(oid)
  ) then
    create or replace function public.cardinal_to_deg(txt text) returns smallint
    language sql immutable as $$
      select case upper(trim($1))
        when 'N'  then 0
        when 'NE' then 45
        when 'E'  then 90
        when 'SE' then 135
        when 'S'  then 180
        when 'SW' then 225
        when 'W'  then 270
        when 'NW' then 315
        else null
      end
    $$;
    comment on function public.cardinal_to_deg(text) is 'Map 8-point cardinal to degrees';
  end if;
end $$;

-- =========================
-- 2) Enum types (idempotent)
-- =========================
do $$ begin
  if not exists (select 1 from pg_type where typname = 'report_kind') then
    create type public.report_kind as enum ('check_in','intel');
  end if;
  if not exists (select 1 from pg_type where typname = 'accuracy_rating') then
    create type public.accuracy_rating as enum ('accurate','somewhat','inaccurate');
  end if;
  if not exists (select 1 from pg_type where typname = 'intel_tag') then
    -- include existing intel tags for backward compatibility
    create type public.intel_tag as enum ('hazard','parking','crowd','wildlife','lost_found','conditions','access','other');
  end if;
end $$;

-- =========================
-- 3) condition_reports table (unified community reports)
-- =========================
do $$ begin
  if to_regclass('public.condition_reports') is null then
    create table public.condition_reports (
      id uuid primary key default gen_random_uuid(),
      beach_id uuid references public.beaches(id) on delete set null,
      reporter_id uuid not null references public.profiles(id) on delete cascade,
      reported_at timestamptz not null default now(),
      kind public.report_kind not null,

      -- structured metrics (SI units)
      wave_height_m numeric check (wave_height_m is null or (wave_height_m >= 0 and wave_height_m <= 15)),
      wave_period_s numeric check (wave_period_s is null or (wave_period_s >= 0 and wave_period_s <= 40)),
      wave_direction_deg smallint check (wave_direction_deg is null or (wave_direction_deg >= 0 and wave_direction_deg < 360)),
      wind_speed_ms numeric check (wind_speed_ms is null or (wind_speed_ms >= 0 and wind_speed_ms <= 70)),
      wind_direction_deg smallint check (wind_direction_deg is null or (wind_direction_deg >= 0 and wind_direction_deg < 360)),
      water_temp_c numeric check (water_temp_c is null or (water_temp_c >= -2 and water_temp_c <= 40)),
      crowd_level int check (crowd_level is null or (crowd_level between 1 and 5)),
      vibe text,
      forecast_accuracy public.accuracy_rating,

      -- intel post extras
      tag public.intel_tag,
      title text,
      description text,
      photo_url text,
      photo_storage_path text,

      -- optional geo to preserve intel_posts proximity features
      latitude numeric,
      longitude numeric,

      confirmations_count int not null default 0,
      is_active boolean not null default true,
      expires_at timestamptz,

      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    comment on table public.condition_reports is 'Unified community condition reports (check-ins + intel posts).';
  end if;
end $$;

-- updated_at trigger
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'update_condition_reports_updated_at') then
    create or replace function public.update_condition_reports_updated_at()
    returns trigger language plpgsql as $$
    begin
      new.updated_at := now();
      return new;
    end;
    $$;
  end if;
  if to_regclass('public.condition_reports') is not null then
    drop trigger if exists trigger_condition_reports_updated_at on public.condition_reports;
    create trigger trigger_condition_reports_updated_at
      before update on public.condition_reports
      for each row execute function public.update_condition_reports_updated_at();
  end if;
end $$;

-- helpful indexes
do $$ begin
  if to_regclass('public.condition_reports') is not null then
    create index if not exists idx_condition_reports_beach_time on public.condition_reports (beach_id, reported_at desc);
    create index if not exists idx_condition_reports_reporter on public.condition_reports (reporter_id, reported_at desc);
    create index if not exists idx_condition_reports_active on public.condition_reports (is_active);
  end if;
end $$;

-- =========================
-- 4) Data migrations from existing tables (best-effort, idempotent)
-- =========================

-- From check_ins → condition_reports(kind='check_in')
do $$ begin
  if to_regclass('public.check_ins') is not null and to_regclass('public.condition_reports') is not null then
    insert into public.condition_reports (
      id, beach_id, reporter_id, reported_at, kind,
      wave_height_m, wind_speed_ms, wind_direction_deg, water_temp_c,
      crowd_level, vibe, forecast_accuracy,
      tag, title, description, photo_url, photo_storage_path,
      confirmations_count, is_active, expires_at, created_at, updated_at
    )
    select
      ci.id,
      ci.beach_id,
      ci.user_id as reporter_id,
      ci.checked_in_at as reported_at,
      'check_in'::public.report_kind,
      case when ci.wave_height is null then null else (ci.wave_height::numeric / 3.28084) end as wave_height_m,
      case when ci.wind_speed is null then null else (ci.wind_speed::numeric / 2.23694) end as wind_speed_ms, -- mph → m/s
      public.cardinal_to_deg(ci.wind_direction) as wind_direction_deg,
      case when ci.water_temp is null then null else ((ci.water_temp::numeric - 32) * 5 / 9) end as water_temp_c,
      ci.crowd_level,
      ci.vibe,
      ci.forecast_accuracy_rating::public.accuracy_rating,
      null, null, null, null, null,
      0, true, null, ci.created_at, ci.updated_at
    from public.check_ins ci
    on conflict (id) do nothing;
  end if;
end $$;

-- From intel_posts → condition_reports(kind='intel')
do $$ begin
  if to_regclass('public.intel_posts') is not null and to_regclass('public.condition_reports') is not null then
    insert into public.condition_reports (
      id, beach_id, reporter_id, reported_at, kind,
      wave_height_m, wind_speed_ms, wind_direction_deg, water_temp_c,
      crowd_level, vibe, forecast_accuracy,
      tag, title, description, photo_url, photo_storage_path,
      latitude, longitude,
      confirmations_count, is_active, expires_at, created_at, updated_at
    )
    select
      ip.id,
      null::uuid as beach_id, -- left null; can be backfilled by nearest-beach process
      ip.user_id as reporter_id,
      ip.created_at as reported_at,
      'intel'::public.report_kind,
      case when ip.wave_height is null then null else (ip.wave_height::numeric / 3.28084) end as wave_height_m,
      case when ip.wind_speed is null then null else (ip.wind_speed::numeric / 2.23694) end as wind_speed_ms, -- mph → m/s
      public.cardinal_to_deg(ip.wind_direction) as wind_direction_deg,
      case when ip.water_temp is null then null else ((ip.water_temp::numeric - 32) * 5 / 9) end as water_temp_c,
      ip.crowd_level,
      null as vibe,
      ip.forecast_accuracy::public.accuracy_rating,
      case
        when ip.tag in ('parking','hazard','crowd','conditions','access','other') then ip.tag::public.intel_tag
        else 'other'::public.intel_tag
      end as tag,
      ip.title,
      ip.description,
      ip.photo_url,
      ip.photo_storage_path,
      ip.latitude,
      ip.longitude,
      ip.confirmations_count,
      ip.is_active,
      ip.expires_at,
      ip.created_at,
      ip.updated_at
    from public.intel_posts ip
    on conflict (id) do nothing;
  end if;
end $$;

-- =========================
-- 5) Re-point confirmations → condition_reports
-- =========================
do $$ begin
  if to_regclass('public.intel_post_confirmations') is not null then
    alter table public.intel_post_confirmations rename to condition_report_confirmations;
  end if;
end $$;

do $$ begin
  if to_regclass('public.condition_report_confirmations') is not null then
    -- rename column if present
    do $$ begin
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'condition_report_confirmations' and column_name = 'intel_post_id'
      ) then
        alter table public.condition_report_confirmations rename column intel_post_id to condition_report_id;
      end if;
    end $$;

    -- drop old fk and create new fk → condition_reports(id)
    do $$ begin
      if exists (select 1 from pg_constraint where conrelid = 'public.condition_report_confirmations'::regclass and conname like '%intel_post%') then
        alter table public.condition_report_confirmations drop constraint if exists intel_post_confirmations_intel_post_id_fkey;
      end if;
    end $$;
    alter table public.condition_report_confirmations
      drop constraint if exists condition_report_confirmations_fk,
      add  constraint condition_report_confirmations_fk
      foreign key (condition_report_id) references public.condition_reports(id) on delete cascade;
  end if;
end $$;

-- maintain confirmations_count via SECURITY DEFINER trigger function
do $$ begin
  if not exists (
    select 1 from pg_proc where proname = 'update_condition_report_confirmations_count'
  ) then
    create or replace function public.update_condition_report_confirmations_count()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $$
    begin
      if tg_op = 'INSERT' then
        update public.condition_reports
        set confirmations_count = confirmations_count + 1
        where id = new.condition_report_id;
        return new;
      elsif tg_op = 'DELETE' then
        update public.condition_reports
        set confirmations_count = greatest(confirmations_count - 1, 0)
        where id = old.condition_report_id;
        return old;
      end if;
      return null;
    end;
    $$;
    comment on function public.update_condition_report_confirmations_count() is 'Maintain confirmations_count on condition_reports despite RLS.';
  end if;
end $$;

do $$ begin
  if to_regclass('public.condition_report_confirmations') is not null then
    drop trigger if exists condition_report_confirmations_count_trigger on public.condition_report_confirmations;
    create trigger condition_report_confirmations_count_trigger
      after insert or delete on public.condition_report_confirmations
      for each row execute function public.update_condition_report_confirmations_count();

    -- backfill confirmations_count to reflect existing confirmations
    update public.condition_reports r
    set confirmations_count = coalesce(c.cnt, 0)
    from (
      select condition_report_id, count(*)::int as cnt
      from public.condition_report_confirmations
      group by condition_report_id
    ) c
    where r.id = c.condition_report_id;
  end if;
end $$;

-- helpful indexes
do $$ begin
  if to_regclass('public.condition_report_confirmations') is not null then
    create index if not exists idx_cr_confirmations_report_id on public.condition_report_confirmations(condition_report_id);
    create index if not exists idx_cr_confirmations_user_id on public.condition_report_confirmations(user_id);
  end if;
end $$;

-- =========================
-- 6) Compatibility views (updatable reads; writes remain to new table in app later)
-- =========================
do $$ begin
  -- check_ins compat (read-only view)
  if to_regclass('public.condition_reports') is not null then
    drop view if exists public.check_ins;
    create view public.check_ins as
    select
      id,
      reporter_id as user_id,
      beach_id,
      reported_at as checked_in_at,
      (wave_height_m * 3.28084)::numeric as wave_height,
      (wind_speed_ms * 2.23694)::numeric as wind_speed,
      case
        when wind_direction_deg is null then null
        when wind_direction_deg between 337 and 360 or wind_direction_deg < 22 then 'N'
        when wind_direction_deg < 67 then 'NE'
        when wind_direction_deg < 112 then 'E'
        when wind_direction_deg < 157 then 'SE'
        when wind_direction_deg < 202 then 'S'
        when wind_direction_deg < 247 then 'SW'
        when wind_direction_deg < 292 then 'W'
        else 'NW'
      end as wind_direction,
      case when water_temp_c is null then null else (water_temp_c * 9/5 + 32) end as water_temp,
      crowd_level,
      vibe,
      forecast_accuracy as forecast_accuracy_rating,
      created_at,
      updated_at
    from public.condition_reports
    where kind = 'check_in';

    comment on view public.check_ins is 'Compatibility view over condition_reports(kind=check_in)';
  end if;
end $$;

do $$ begin
  -- intel_posts compat (read-only view)
  if to_regclass('public.condition_reports') is not null then
    drop view if exists public.intel_posts;
    create view public.intel_posts as
    select
      id,
      reporter_id as user_id,
      latitude,
      longitude,
      tag::text as tag,
      title,
      description,
      confirmations_count,
      is_active,
      expires_at,
      created_at,
      updated_at,
      -- optional surf condition fields (legacy units)
      (wave_height_m * 3.28084)::numeric as wave_height,
      (wind_speed_ms * 2.23694)::numeric as wind_speed,
      case
        when wind_direction_deg is null then null
        when wind_direction_deg between 337 and 360 or wind_direction_deg < 22 then 'N'
        when wind_direction_deg < 67 then 'NE'
        when wind_direction_deg < 112 then 'E'
        when wind_direction_deg < 157 then 'SE'
        when wind_direction_deg < 202 then 'S'
        when wind_direction_deg < 247 then 'SW'
        when wind_direction_deg < 292 then 'W'
        else 'NW'
      end as wind_direction,
      case when water_temp_c is null then null else (water_temp_c * 9/5 + 32) end as water_temp,
      crowd_level,
      forecast_accuracy::text as forecast_accuracy,
      null::text[] as wave_types,
      photo_url,
      photo_storage_path
    from public.condition_reports
    where kind = 'intel';

    comment on view public.intel_posts is 'Compatibility view over condition_reports(kind=intel)';
  end if;
end $$;

-- =========================
-- 7) Hourly conditions layer (MV + UI view)
-- =========================
do $$ begin
  if to_regclass('public.marine_forecasts') is not null then
    drop materialized view if exists public.hourly_conditions_mv;
    create materialized view public.hourly_conditions_mv as
    with src as (
      select
        m.beach_id,
        date_trunc('hour', m.ts) as ts_hour,
        avg(m.wave_height_m) as wave_height_m,
        avg(m.wave_period_s) as wave_period_s,
        avg(m.wave_direction_deg) as wave_direction_deg,
        avg(m.wind_speed_ms) as wind_speed_ms,
        avg(m.wind_direction_deg) as wind_direction_deg,
        bool_or(coalesce(m.is_observed, false)) as has_observed
      from public.marine_forecasts m
      group by m.beach_id, date_trunc('hour', m.ts)
    )
    select
      s.beach_id,
      s.ts_hour,
      s.wave_height_m,
      s.wave_period_s,
      s.wave_direction_deg,
      s.wind_speed_ms,
      s.wind_direction_deg,
      s.has_observed,
      t.tide_height_m,
      t.tide_phase,
      (s.ts_hour between st.sunrise_utc and st.sunset_utc) as is_daylight,
      jsonb_build_object('sources', array_agg(distinct coalesce(mf.source, 'unknown'))) as meta
    from src s
    left join public.tide_forecasts t
      on t.beach_id = s.beach_id and date_trunc('hour', t.ts) = s.ts_hour
    left join public.sun_times st
      on st.beach_id = s.beach_id and st.date::date = s.ts_hour::date
    left join public.marine_forecasts mf
      on mf.beach_id = s.beach_id and date_trunc('hour', mf.ts) = s.ts_hour
    group by s.beach_id, s.ts_hour, s.wave_height_m, s.wave_period_s, s.wave_direction_deg,
             s.wind_speed_ms, s.wind_direction_deg, s.has_observed, t.tide_height_m, t.tide_phase,
             st.sunrise_utc, st.sunset_utc;

    create unique index if not exists idx_hourly_conditions_mv_key
      on public.hourly_conditions_mv (beach_id, ts_hour);
    create index if not exists idx_hourly_conditions_lookup
      on public.hourly_conditions_mv (beach_id, ts_hour desc);
    comment on materialized view public.hourly_conditions_mv is 'Numeric-first hourly conditions across marine/tide/sun.';
  end if;
end $$;

-- UI-friendly view over MV
do $$ begin
  if to_regclass('public.hourly_conditions_mv') is not null then
    create or replace view public.hourly_conditions_ui as
    select
      beach_id,
      ts_hour,
      (wave_height_m * 3.28084)::numeric(6,2) || ' ft' as wave_height,
      wave_period_s::numeric(6,2) || ' s' as wave_period,
      (case when wave_direction_deg is null then null else wave_direction_deg end) as wave_direction_deg,
      (wind_speed_ms * 1.94384)::numeric(6,2) || ' kt' as wind_speed,
      (case when wind_direction_deg is null then null else wind_direction_deg end) as wind_direction_deg,
      tide_phase,
      (tide_height_m * 3.28084)::numeric(6,2) || ' ft' as tide_height,
      case when is_daylight then 'Day' else 'Night' end as daylight,
      meta
    from public.hourly_conditions_mv;
    comment on view public.hourly_conditions_ui is 'UI-ready hourly strings derived from hourly_conditions_mv';
  end if;
end $$;

-- =========================
-- 8) Aggregation MVs (ratings and storage usage)
-- =========================
do $$ begin
  if to_regclass('public.beaches') is not null then
    drop materialized view if exists public.beach_stats_mv;
    create materialized view public.beach_stats_mv as
    select b.id as beach_id,
           count(r.id) as review_count,
           avg(r.overall_rating)::numeric(4,2) as overall_rating,
           avg(r.wave_quality_rating)::numeric(4,2) as wave_quality_rating,
           avg(r.crowd_density_rating)::numeric(4,2) as crowd_density_rating,
           avg(r.parking_rating)::numeric(4,2) as parking_rating,
           avg(r.accessibility_rating)::numeric(4,2) as accessibility_rating
    from public.beaches b
    left join public.beach_reviews r on r.beach_id = b.id
    group by b.id;
    create unique index if not exists idx_beach_stats_mv_key on public.beach_stats_mv (beach_id);
    comment on materialized view public.beach_stats_mv is 'Aggregated ratings per beach.';
  end if;
end $$;

do $$ begin
  if to_regclass('public.session_media') is not null then
    drop materialized view if exists public.storage_usage_mv;
    create materialized view public.storage_usage_mv as
    select user_id,
           coalesce(sum(file_size), 0)::bigint as total_bytes,
           count(*) filter (where media_type = 'photo') as image_count,
           max(created_at) as last_updated
    from public.session_media
    group by user_id;
    create unique index if not exists idx_storage_usage_mv_key on public.storage_usage_mv (user_id);
    comment on materialized view public.storage_usage_mv is 'Aggregated storage usage per user from session_media.';
  end if;
end $$;

-- =========================
-- 9) Standards: timestamps/uuids/arrays (idempotent touch-ups)
-- =========================
do $$ begin
  -- sessions: ensure UUID default
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sessions' and column_name = 'id'
  ) then
    alter table public.sessions alter column id set default gen_random_uuid();
  end if;
  -- session_media.created_at → timestamptz default now()
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'session_media' and column_name = 'created_at'
  ) then
    alter table public.session_media
      alter column created_at type timestamptz using created_at at time zone 'UTC',
      alter column created_at set default now();
  end if;
end $$;

-- =========================
-- 10) Constraints & uniqueness (anti-dup + integrity)
-- =========================
create unique index if not exists favorite_beaches_unique on public.favorite_beaches (user_id, beach_id);
create unique index if not exists user_follows_unique on public.user_follows (follower_id, following_id);
create unique index if not exists session_likes_unique on public.session_likes (session_id, user_id);
create unique index if not exists session_participants_unique on public.session_participants (session_id, user_id);

do $$ begin
  if to_regclass('public.session_invitations') is not null then
    do $$ begin
      if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.session_invitations'::regclass and conname = 'invitee_present_chk'
      ) then
        alter table public.session_invitations
          add constraint invitee_present_chk
          check (invitee_id is not null or invitee_email is not null);
      end if;
    end $$;
  end if;
end $$;

do $$ begin
  if to_regclass('public.beaches') is not null then
    do $$ begin
      if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.beaches'::regclass and conname = 'private_beach_owner_chk'
      ) then
        alter table public.beaches
          add constraint private_beach_owner_chk check (not is_private or owner_id is not null);
      end if;
    end $$;
  end if;
end $$;

-- calibration windows: generated daterange + no overlap per beach
do $$ begin
  if to_regclass('public.beach_recommendation_calibration') is not null then
    do $$ begin
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'beach_recommendation_calibration' and column_name = 'window'
      ) then
        alter table public.beach_recommendation_calibration
          add column window daterange generated always as (daterange(window_start, window_end, '[]')) stored;
      end if;
    end $$;
    do $$ begin
      if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.beach_recommendation_calibration'::regclass and conname = 'brc_no_overlap'
      ) then
        alter table public.beach_recommendation_calibration
          add constraint brc_no_overlap exclude using gist (beach_id with =, window with &&);
      end if;
    end $$;
  end if;
end $$;

-- =========================
-- 11) Cascades and practical indexes
-- =========================
do $$ begin
  -- comments
  if to_regclass('public.comments') is not null then
    if exists (select 1 from pg_constraint where conname = 'comments_session_id_fkey') then
      alter table public.comments drop constraint comments_session_id_fkey;
    end if;
    alter table public.comments add constraint comments_session_id_fkey
      foreign key (session_id) references public.sessions(id) on delete cascade;
    if exists (select 1 from pg_constraint where conname = 'comments_parent_comment_fkey') then
      alter table public.comments drop constraint comments_parent_comment_fkey;
    end if;
    alter table public.comments add constraint comments_parent_comment_fkey
      foreign key (parent_comment) references public.comments(id) on delete cascade;
  end if;

  -- session_media
  if to_regclass('public.session_media') is not null then
    if exists (select 1 from pg_constraint where conname = 'session_media_session_id_fkey') then
      alter table public.session_media drop constraint session_media_session_id_fkey;
    end if;
    alter table public.session_media add constraint session_media_session_id_fkey
      foreign key (session_id) references public.sessions(id) on delete cascade;
  end if;

  -- participants
  if to_regclass('public.session_participants') is not null then
    if exists (select 1 from pg_constraint where conname = 'session_participants_session_id_fkey') then
      alter table public.session_participants drop constraint session_participants_session_id_fkey;
    end if;
    alter table public.session_participants add constraint session_participants_session_id_fkey
      foreign key (session_id) references public.sessions(id) on delete cascade;
  end if;

  -- likes
  if to_regclass('public.session_likes') is not null then
    if exists (select 1 from pg_constraint where conname = 'session_likes_session_id_fkey') then
      alter table public.session_likes drop constraint session_likes_session_id_fkey;
    end if;
    alter table public.session_likes add constraint session_likes_session_id_fkey
      foreign key (session_id) references public.sessions(id) on delete cascade;
  end if;

  -- invitations
  if to_regclass('public.session_invitations') is not null then
    if exists (select 1 from pg_constraint where conname = 'session_invitations_session_id_fkey') then
      alter table public.session_invitations drop constraint session_invitations_session_id_fkey;
    end if;
    alter table public.session_invitations add constraint session_invitations_session_id_fkey
      foreign key (session_id) references public.sessions(id) on delete cascade;
  end if;
end $$;

-- practical feed/report indexes
create index if not exists sessions_feed_idx on public.sessions (beach_id, created_at desc);
create index if not exists sessions_arrival_idx on public.sessions (profile_id, arrival_time desc);
create index if not exists cond_reports_beach_time on public.condition_reports (beach_id, reported_at desc);

-- dedupe time series
create unique index if not exists marine_dedupe_idx on public.marine_forecasts (beach_id, ts, source);
create unique index if not exists tide_dedupe_idx   on public.tide_forecasts (beach_id, ts, source);

-- =========================
-- 12) RLS for condition_reports (+ confirmations)
-- =========================
do $$ begin
  if to_regclass('public.condition_reports') is not null then
    alter table public.condition_reports enable row level security;
    drop policy if exists cr_select on public.condition_reports;
    drop policy if exists cr_insert on public.condition_reports;
    drop policy if exists cr_update_own on public.condition_reports;
    drop policy if exists cr_delete_own on public.condition_reports;

    create policy cr_select on public.condition_reports for select using (true);
    create policy cr_insert on public.condition_reports for insert with check (reporter_id = (select auth.uid()));
    create policy cr_update_own on public.condition_reports for update using (reporter_id = (select auth.uid()));
    create policy cr_delete_own on public.condition_reports for delete using (reporter_id = (select auth.uid()));
  end if;
  if to_regclass('public.condition_report_confirmations') is not null then
    alter table public.condition_report_confirmations enable row level security;
    drop policy if exists crc_select on public.condition_report_confirmations;
    drop policy if exists crc_insert on public.condition_report_confirmations;
    drop policy if exists crc_delete on public.condition_report_confirmations;

    create policy crc_select on public.condition_report_confirmations for select using (true);
    create policy crc_insert on public.condition_report_confirmations for insert with check (user_id = (select auth.uid()));
    create policy crc_delete on public.condition_report_confirmations for delete using (user_id = (select auth.uid()));
  end if;
end $$;

-- =========================
-- 13) Comments
-- =========================
comment on index cond_reports_beach_time is 'Lookup reports per beach by recent time';
comment on index idx_hourly_conditions_lookup is 'Lookup hourly conditions per beach quickly';


