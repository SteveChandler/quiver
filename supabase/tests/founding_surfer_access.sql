\set ON_ERROR_STOP on
-- Standalone disposable PostgreSQL fixture; run scripts/test-founding-access-postgres.sh.
-- Proves every DB gate in 20261104160000_founding_surfer_access.sql with the switch OFF
-- (today's behavior), ON (founding users unlocked) and OFF again.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE SCHEMA extensions;
GRANT USAGE ON SCHEMA auth, extensions TO anon, authenticated, service_role;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'service_role')
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- PostGIS stand-ins: get_user_match_candidates only needs them to plan and filter.
CREATE DOMAIN extensions.geography AS text;
CREATE FUNCTION extensions.st_makepoint(double precision, double precision) RETURNS text
  LANGUAGE sql IMMUTABLE AS $$ SELECT $1::text || ',' || $2::text $$;
CREATE FUNCTION extensions.st_setsrid(text, integer) RETURNS text
  LANGUAGE sql IMMUTABLE AS $$ SELECT $1 $$;
CREATE FUNCTION extensions.st_distance(extensions.geography, extensions.geography) RETURNS double precision
  LANGUAGE sql IMMUTABLE AS $$ SELECT 0::double precision $$;
CREATE FUNCTION extensions.st_dwithin(extensions.geography, extensions.geography, double precision) RETURNS boolean
  LANGUAGE sql IMMUTABLE AS $$ SELECT true $$;

CREATE TABLE public.user_entitlements (
  user_id uuid PRIMARY KEY, is_pro boolean, is_trialing boolean, billing_issue boolean, expires_at timestamptz
);
CREATE TABLE public.profiles (id uuid PRIMARY KEY, max_drive_minutes integer);
CREATE TABLE public.beaches (
  id uuid PRIMARY KEY, name text, lat double precision, lon double precision,
  geog extensions.geography, deleted_at timestamptz, recommendation_eligible boolean
);
CREATE TABLE public.custom_spots (id uuid PRIMARY KEY, user_id uuid, deleted_at timestamptz);
CREATE TABLE public.favorite_beaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, beach_id uuid, custom_spot_id uuid,
  rank integer, alerts_enabled boolean
);
CREATE TABLE public.enhanced_forecasts (
  beach_id uuid, forecast_at timestamptz, wave_height text, wave_period text, wind_speed text,
  wind_direction_deg numeric, tide_height text
);

-- The real scorer opens with user_match_access_result; the stand-in keeps that contract.
SET check_function_bodies = off;
CREATE FUNCTION public.compute_user_match_score(
  p_user_id uuid, p_beach_id uuid, p_wave_height text, p_wave_period text,
  p_wind_speed text, p_wind_direction text, p_tide_height text
) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(public.user_match_access_result(p_user_id),
    '{"state":"learned","score":7.2,"label":"GOOD"}'::jsonb)
$$;
CREATE FUNCTION public.compute_user_match_scores(p_user_id uuid, p_beach_ids uuid[], p_slots jsonb)
RETURNS TABLE(slot_idx integer, beach_id uuid, forecast_at text, result jsonb)
LANGUAGE sql STABLE AS $$
  SELECT (ordinality - 1)::integer, (value->>'beach_id')::uuid, value->>'forecast_at',
    '{"state":"learned","score":7.2}'::jsonb
  FROM jsonb_array_elements(p_slots) WITH ORDINALITY
$$;

RESET check_function_bodies;

\ir ../migrations/20261104160000_founding_surfer_access.sql

CREATE FUNCTION fixture_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;
-- 1 free (no entitlement row), 2 Pro, 3 Pro with billing issue, 4 expired Pro mirror.
INSERT INTO public.profiles SELECT fixture_id(n), NULL FROM generate_series(1, 4) n;
INSERT INTO public.user_entitlements VALUES
  (fixture_id(2), true, false, false, NULL),
  (fixture_id(3), true, false, true, now() - interval '3 days'),
  (fixture_id(4), true, false, false, now() - interval '1 day');
INSERT INTO public.beaches
SELECT fixture_id(100 + n), 'Beach ' || n, 33, -117, 'POINT', NULL, true FROM generate_series(1, 6) n;
INSERT INTO public.enhanced_forecasts
SELECT fixture_id(100 + n), now() + interval '1 hour', '3 ft', '10s', '5 mph', 90, '2.1'
FROM generate_series(1, 6) n;
-- Each user already holds the free cap of three curated favorites.
INSERT INTO public.favorite_beaches (user_id, beach_id, rank, alerts_enabled)
SELECT fixture_id(u), fixture_id(100 + n), n, false
FROM generate_series(1, 4) u CROSS JOIN generate_series(1, 3) n;

CREATE FUNCTION as_user(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.role', 'authenticated', false),
    set_config('request.jwt.claim.sub', p_user::text, false);
$$;
CREATE FUNCTION as_service() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.role', 'service_role', false),
    set_config('request.jwt.claim.sub', '', false);
$$;
CREATE FUNCTION toggle_error(p_user uuid, p_beach uuid) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM as_user(p_user);
  RETURN public.toggle_favorite_spot_guarded(p_beach, NULL);
EXCEPTION WHEN raise_exception THEN
  RETURN SQLERRM;
END $$;
CREATE FUNCTION lock_reason(p_user uuid) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM as_user(p_user);
  RETURN COALESCE(public.user_match_access_result(p_user)->>'lock_reason', 'unlocked');
END $$;
CREATE FUNCTION candidate_count(p_user uuid) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v integer;
BEGIN
  PERFORM as_user(p_user);
  SELECT count(*) INTO v FROM public.get_user_match_candidates(p_user, NULL, NULL, NULL, 50, 5);
  RETURN v;
END $$;
CREATE FUNCTION scout_match_count(p_user uuid) RETURNS integer LANGUAGE plpgsql AS $$
BEGIN
  PERFORM as_service();
  RETURN jsonb_array_length(public.get_week_scout_personalization(
    p_user, ARRAY[fixture_id(101)],
    jsonb_build_array(jsonb_build_object('beach_id', fixture_id(101), 'forecast_at', '2026-11-05T12:00:00Z'))
  )->'matches');
END $$;
CREATE FUNCTION set_switch(p_on boolean) RETURNS void LANGUAGE sql AS $$
  UPDATE public.app_runtime_flags SET enabled = p_on, updated_at = now() WHERE key = 'founding_access';
$$;

-- Grants: the switch is readable through the function only.
DO $$
DECLARE denied boolean;
BEGIN
  SET LOCAL ROLE authenticated;
  ASSERT public.founding_access_enabled() = false, 'authenticated can read the switch';
  BEGIN
    PERFORM 1 FROM public.app_runtime_flags;
    denied := false;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'authenticated must not read app_runtime_flags directly';
  RESET ROLE;
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.founding_access_enabled();
    denied := false;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'anon must not execute founding_access_enabled()';
  RESET ROLE;
END $$;

-- OFF: today's gates.
DO $$
BEGIN
  ASSERT public.founding_access_enabled() = false, 'seed row ships off';
  ASSERT toggle_error(fixture_id(1), fixture_id(104)) = 'favorite_quota_exceeded', 'OFF: free cap holds';
  ASSERT toggle_error(fixture_id(2), fixture_id(104)) = 'added', 'OFF: Pro has no cap';
  ASSERT lock_reason(fixture_id(1)) = 'free', 'OFF: free user locked for free';
  ASSERT lock_reason(fixture_id(4)) = 'free', 'OFF: expired mirror locked for free';
  ASSERT lock_reason(fixture_id(2)) = 'unlocked', 'OFF: Pro unlocked';
  ASSERT lock_reason(fixture_id(3)) = 'billing_issue', 'OFF: billing issue lock';
  ASSERT candidate_count(fixture_id(1)) = 0, 'OFF: free user gets no candidates';
  ASSERT candidate_count(fixture_id(2)) > 0, 'OFF: Pro gets candidates';
  ASSERT candidate_count(fixture_id(3)) = 0, 'OFF: billing issue gets no candidates';
  ASSERT scout_match_count(fixture_id(1)) = 0, 'OFF: free user gets no scout matches';
  ASSERT scout_match_count(fixture_id(2)) = 1, 'OFF: Pro gets scout matches';
END $$;

-- ON: founding users get the Pro feature gates; billing and auth locks stay.
SELECT set_switch(true);
DO $$
DECLARE forbidden text;
BEGIN
  ASSERT public.founding_access_enabled() = true, 'switch on';
  ASSERT toggle_error(fixture_id(1), fixture_id(104)) = 'added', 'ON: free user passes the cap';
  ASSERT toggle_error(fixture_id(1), fixture_id(105)) = 'added', 'ON: free user adds again';
  ASSERT lock_reason(fixture_id(1)) = 'unlocked', 'ON: free user unlocked';
  ASSERT lock_reason(fixture_id(4)) = 'unlocked', 'ON: expired mirror unlocked';
  ASSERT lock_reason(fixture_id(3)) = 'billing_issue', 'ON: billing issue lock stays';
  PERFORM as_user(fixture_id(2));
  forbidden := public.user_match_access_result(fixture_id(1))->>'lock_reason';
  ASSERT forbidden = 'forbidden', 'ON: other users stay forbidden';
  ASSERT candidate_count(fixture_id(1)) > 0, 'ON: free user gets candidates';
  ASSERT candidate_count(fixture_id(3)) = 0, 'ON: billing issue still gets none';
  ASSERT scout_match_count(fixture_id(1)) = 1, 'ON: free user gets scout matches';
END $$;

-- OFF again: adds are capped, saved favorites above the cap stay.
SELECT set_switch(false);
DO $$
BEGIN
  ASSERT toggle_error(fixture_id(1), fixture_id(106)) = 'favorite_quota_exceeded', 'OFF again: cap returns';
  ASSERT (SELECT count(*) FROM public.favorite_beaches WHERE user_id = fixture_id(1)) = 5,
    'OFF again: favorites above the cap stay saved';
  ASSERT toggle_error(fixture_id(1), fixture_id(105)) = 'removed', 'OFF again: removing still works';
  ASSERT lock_reason(fixture_id(1)) = 'free', 'OFF again: free lock returns';
  ASSERT candidate_count(fixture_id(1)) = 0, 'OFF again: no candidates';
  ASSERT scout_match_count(fixture_id(1)) = 0, 'OFF again: no scout matches';
END $$;

-- A missing row reads as off.
DELETE FROM public.app_runtime_flags WHERE key = 'founding_access';
DO $$
BEGIN
  ASSERT public.founding_access_enabled() = false, 'missing row reads as off';
END $$;

\echo 'founding surfer access: all assertions passed'
