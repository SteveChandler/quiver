-- Implicit Preference Learning Infrastructure
--
-- Description: Implements implicit preference learning to solve the cold-start problem
-- for personalized surf recommendations. Captures behavioral signals (beach views,
-- forecast checks, etc.) and aggregates them into inferred preferences.
--
-- Author: supabase-db-expert
-- Date: 2026-01-25
-- Issue: Cold-start personalization - learn preferences from user behavior
--
-- Tables:
--   - user_events: Captures raw behavioral signals with 90-day expiration
--   - user_implicit_preferences: Aggregated preferences computed from events
--   - profiles.allow_implicit_tracking: Privacy opt-out column
--
-- Functions:
--   - cleanup_expired_events(): Scheduled cleanup of events older than 90 days
--   - purge_implicit_history(): User-initiated deletion of all implicit data

begin;

-- ==============================================================================
-- TABLE: user_events
-- ==============================================================================
-- Captures behavioral signals for implicit preference learning
-- Events expire after 90 days to respect privacy and maintain data freshness

create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  beach_id uuid references public.beaches(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),

  -- Constraint: Only allow valid event types
  constraint user_events_event_type_check check (
    event_type in (
      'beach_view',        -- User viewed beach detail page
      'discovery_click',   -- User clicked beach from discovery feed
      'discovery_skip',    -- User swiped/skipped past beach in discovery
      'forecast_check',    -- User checked forecast tab
      'location_update'    -- User's location changed (for travel radius)
    )
  )
);

-- Indexes for efficient queries
create index if not exists idx_user_events_user_id
  on public.user_events(user_id, created_at desc);

create index if not exists idx_user_events_beach_id
  on public.user_events(beach_id, created_at desc)
  where beach_id is not null;

create index if not exists idx_user_events_event_type
  on public.user_events(event_type, created_at desc);

create index if not exists idx_user_events_expires_at
  on public.user_events(expires_at)
  where expires_at < now() + interval '7 days';  -- Only index soon-to-expire events

-- Comments for documentation
comment on table public.user_events is 'Behavioral signals for implicit preference learning. Events auto-expire after 90 days.';
comment on column public.user_events.event_type is 'Type of behavioral signal: beach_view, discovery_click, discovery_skip, forecast_check, location_update';
comment on column public.user_events.beach_id is 'Optional beach reference. NULL for non-beach events like location_update';
comment on column public.user_events.metadata is 'Event-specific data: {wave_height_ft, break_type, time_of_day, lat, lon, etc.}';
comment on column public.user_events.expires_at is 'Auto-deletion timestamp (90 days from creation). Maintains privacy and data freshness.';

-- ==============================================================================
-- TABLE: user_implicit_preferences
-- ==============================================================================
-- Aggregated preferences computed from user_events
-- Updated by scheduled aggregation function (see migration 20260125120001)

create table if not exists public.user_implicit_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- Inferred wave size preferences (in feet)
  inferred_wave_min_ft numeric(4,1) check (inferred_wave_min_ft >= 0 and inferred_wave_min_ft <= 50),
  inferred_wave_max_ft numeric(4,1) check (inferred_wave_max_ft >= 0 and inferred_wave_max_ft <= 50),

  -- Break type weights: {beach: 0.6, point: 0.3, reef: 0.1}
  break_type_weights jsonb not null default '{}'::jsonb,

  -- Time slot weights: {morning: 0.7, afternoon: 0.2, evening: 0.1}
  time_slot_weights jsonb not null default '{}'::jsonb,

  -- Geographic preferences
  location_centroid_lat numeric(10,7),  -- Centroid of user's typical surf area
  location_centroid_lon numeric(10,7),
  typical_travel_radius_miles numeric(6,2),  -- How far user typically travels

  -- Top engaged beaches (for "return visitor" signals)
  top_engaged_beach_ids uuid[] default array[]::uuid[],

  -- Confidence metrics
  confidence numeric(3,2) not null default 0.0 check (confidence >= 0 and confidence <= 1),
  event_count integer not null default 0,  -- Total events used for this computation

  -- Computation metadata
  last_computed_at timestamptz not null default now(),
  computed_from timestamptz not null default now(),  -- Start of event window
  computed_to timestamptz not null default now(),    -- End of event window

  -- Constraints
  constraint wave_range_valid check (
    (inferred_wave_min_ft is null and inferred_wave_max_ft is null) or
    (inferred_wave_min_ft <= inferred_wave_max_ft)
  )
);

-- Indexes for preference-based queries
create index if not exists idx_user_implicit_preferences_confidence
  on public.user_implicit_preferences(confidence desc)
  where confidence >= 0.3;  -- Only index users with meaningful confidence

create index if not exists idx_user_implicit_preferences_location
  on public.user_implicit_preferences(location_centroid_lat, location_centroid_lon)
  where location_centroid_lat is not null and location_centroid_lon is not null;

-- GIN index for break_type_weights JSONB queries
create index if not exists idx_user_implicit_preferences_break_types
  on public.user_implicit_preferences using gin(break_type_weights);

-- GIN index for top_engaged_beach_ids array queries
create index if not exists idx_user_implicit_preferences_beaches
  on public.user_implicit_preferences using gin(top_engaged_beach_ids);

-- Comments for documentation
comment on table public.user_implicit_preferences is 'Aggregated preferences computed from user behavioral signals. Updated by scheduled function.';
comment on column public.user_implicit_preferences.inferred_wave_min_ft is 'Inferred minimum wave height preference from engagement patterns';
comment on column public.user_implicit_preferences.inferred_wave_max_ft is 'Inferred maximum wave height preference from engagement patterns';
comment on column public.user_implicit_preferences.break_type_weights is 'Normalized weights for break types: {beach: 0.6, point: 0.3, reef: 0.1}';
comment on column public.user_implicit_preferences.time_slot_weights is 'Normalized weights for time slots: {morning: 0.7, afternoon: 0.2, evening: 0.1}';
comment on column public.user_implicit_preferences.location_centroid_lat is 'Centroid latitude of user typical surf area (computed from location_update events)';
comment on column public.user_implicit_preferences.location_centroid_lon is 'Centroid longitude of user typical surf area (computed from location_update events)';
comment on column public.user_implicit_preferences.typical_travel_radius_miles is 'Typical travel radius computed from location variance';
comment on column public.user_implicit_preferences.top_engaged_beach_ids is 'Array of most-engaged beach UUIDs (sorted by engagement score)';
comment on column public.user_implicit_preferences.confidence is 'Confidence score 0-1 based on event count and recency. 0.3+ is meaningful.';
comment on column public.user_implicit_preferences.event_count is 'Total behavioral events used for this preference computation';

-- ==============================================================================
-- COLUMN: profiles.allow_implicit_tracking
-- ==============================================================================
-- Privacy control: allows users to opt-out of implicit preference learning

alter table public.profiles
  add column if not exists allow_implicit_tracking boolean not null default true;

create index if not exists idx_profiles_allow_implicit_tracking
  on public.profiles(allow_implicit_tracking)
  where allow_implicit_tracking = true;

comment on column public.profiles.allow_implicit_tracking is
  'Privacy opt-out: if false, no user_events are recorded and preferences are not computed. Default true.';

-- ==============================================================================
-- FUNCTION: cleanup_expired_events()
-- ==============================================================================
-- Deletes events older than their expires_at timestamp
-- Should be scheduled to run daily via pg_cron or similar

create or replace function public.cleanup_expired_events()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count integer;
begin
  delete from public.user_events
  where expires_at < now();

  get diagnostics deleted_count = row_count;

  return deleted_count;
end;
$$;

comment on function public.cleanup_expired_events() is
  'Deletes events past their expires_at timestamp. Schedule daily. Returns count of deleted rows.';

-- ==============================================================================
-- FUNCTION: purge_implicit_history(target_user_id)
-- ==============================================================================
-- User-initiated deletion of all implicit preference data
-- Called from "Clear my data" button in privacy settings
-- Security: Only allows users to delete their own data, or service role to delete any user

create or replace function public.purge_implicit_history(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Security check: user can only purge their own data
  -- Service role bypasses RLS and can purge any user
  if target_user_id != (select auth.uid()) and current_setting('role', true) != 'service_role' then
    raise exception 'Unauthorized';
  end if;

  -- Delete all events for this user
  delete from public.user_events
  where user_id = target_user_id;

  -- Delete implicit preferences for this user
  delete from public.user_implicit_preferences
  where user_id = target_user_id;

  -- Note: Does NOT change profiles.allow_implicit_tracking
  -- User can disable tracking separately via settings
end;
$$;

comment on function public.purge_implicit_history(uuid) is
  'Deletes all implicit preference data for a user. User can only purge their own data. For "Clear my data" button.';

-- ==============================================================================
-- RLS POLICIES
-- ==============================================================================

-- Enable RLS on new tables
alter table public.user_events enable row level security;
alter table public.user_implicit_preferences enable row level security;

-- Drop existing policies if they exist (for idempotency)
drop policy if exists "Users can insert their own events" on public.user_events;
drop policy if exists "Users can view their own events" on public.user_events;
drop policy if exists "Users can delete their own events" on public.user_events;
drop policy if exists "Service role has full access to events" on public.user_events;

drop policy if exists "Users can view their own preferences" on public.user_implicit_preferences;
drop policy if exists "Service role has full access to preferences" on public.user_implicit_preferences;

-- ---------------------------------------------------------
-- user_events RLS policies
-- ---------------------------------------------------------

-- Users can insert their own events (respecting allow_implicit_tracking)
create policy "Users can insert their own events"
  on public.user_events
  for insert
  with check (
    (select auth.uid()) = user_id and
    exists (
      select 1 from public.profiles
      where id = (select auth.uid())
      and allow_implicit_tracking = true
    )
  );

-- Users can view their own events
create policy "Users can view their own events"
  on public.user_events
  for select
  using ((select auth.uid()) = user_id);

-- Users can delete their own events
create policy "Users can delete their own events"
  on public.user_events
  for delete
  using ((select auth.uid()) = user_id);

-- Service role has full access (for aggregation function)
create policy "Service role has full access to events"
  on public.user_events
  for all
  using (
    current_setting('role', true) = 'service_role' or
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- ---------------------------------------------------------
-- user_implicit_preferences RLS policies
-- ---------------------------------------------------------

-- Users can view their own preferences
create policy "Users can view their own preferences"
  on public.user_implicit_preferences
  for select
  using ((select auth.uid()) = user_id);

-- Service role has full access (for aggregation function)
create policy "Service role has full access to preferences"
  on public.user_implicit_preferences
  for all
  using (
    current_setting('role', true) = 'service_role' or
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- Note: profiles.allow_implicit_tracking is covered by existing profiles RLS policies
-- Users can read all profiles (public data), update only their own

commit;
