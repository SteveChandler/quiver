\set ON_ERROR_STOP on
-- Only the disposable cluster created by scripts/test-session-wave-size-vs-forecast-postgres.sh.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;

-- The pre-migration shape of the tables the migration and its functions touch.
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  analytics_is_real_user boolean,
  is_mock boolean,
  email text
);
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  beach_id uuid,
  arrival_time timestamptz,
  status text,
  wave_height_ft numeric,
  wave_height_source text CHECK (wave_height_source IN ('user', 'forecast_prefill')),
  forecast_accuracy text,
  forecast_wave_height_ft numeric,
  wave_quality integer,
  water_temp numeric,
  crowd_level integer,
  parking_ease integer,
  rating integer,
  notes text,
  duration_minutes integer,
  wind_speed_mph numeric,
  wind_direction text,
  tide_height_ft numeric,
  tide_status text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id uuid,
  event_type text,
  metadata jsonb,
  bot_flagged boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.session_forecast_snapshots (session_id uuid PRIMARY KEY);
CREATE TABLE public.ml_predictions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id uuid,
  display_source text,
  predicted_at timestamptz,
  forecast_horizon_bucket text,
  forecast_horizon_hours integer,
  created_at timestamptz DEFAULT now(),
  offset_corrected_display_height_m numeric,
  raw_display_height_m numeric,
  corrected_forecast_m numeric,
  raw_forecast_m numeric,
  wave_height_om numeric,
  v5_shadow_height_m numeric,
  observed_m numeric,
  model_version text,
  v5_model_version text,
  candidate_model_version text
);
CREATE TABLE public.session_wave_observation_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE,
  user_id uuid,
  beach_id uuid,
  ml_prediction_id uuid,
  observed_at timestamptz,
  reported_wave_height_ft numeric,
  observed_m numeric,
  nearest_prediction_delta_minutes numeric,
  observation_source text DEFAULT 'user_session',
  quality_state text DEFAULT 'weak',
  rejection_reason text,
  observation_weight numeric,
  source_created_by text,
  matched_prediction_at timestamptz,
  snapshot_display_height_m numeric,
  snapshot_raw_om_height_m numeric,
  snapshot_v5_shadow_height_m numeric,
  snapshot_buoy_observed_m numeric,
  snapshot_raw_forecast_m numeric,
  snapshot_corrected_forecast_m numeric,
  snapshot_model_version text,
  snapshot_v5_model_version text,
  snapshot_candidate_model_version text,
  snapshot_display_source text,
  forecast_horizon_hours integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- The real snapshot function starts by syncing the candidate; the rest is out of scope here.
CREATE FUNCTION public.create_session_forecast_snapshot() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.sync_session_wave_observation_candidate(
    new.id, new.user_id, new.beach_id, new.arrival_time, new.status, new.wave_height_ft, 'trigger'
  );
  RETURN new;
END;
$$;
CREATE TRIGGER trigger_create_session_forecast_snapshot
  AFTER INSERT OR UPDATE OF status, beach_id, wave_height_ft, forecast_accuracy
  ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.create_session_forecast_snapshot();

CREATE FUNCTION fixture_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;

CREATE FUNCTION assert_equal(label text, actual anyelement, expected anyelement) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION '%: expected %, got %', label, expected, actual;
  END IF;
END;
$$;

-- Applying twice proves the migration is re-runnable.
\ir ../migrations/20261021200000_session_wave_size_vs_forecast.sql
\ir ../migrations/20261021200000_session_wave_size_vs_forecast.sql

INSERT INTO public.profiles VALUES (fixture_id(1), true, false, 'surfer@quiver.example');
INSERT INTO public.ml_predictions_log (beach_id, display_source, predicted_at, forecast_horizon_bucket, raw_display_height_m)
VALUES (fixture_id(100), 'face-Hs-transformer-v1', '2026-10-21 16:00+00', '0-24h', 0.85);

-- 11: prefill confirmed about right -> kept as a weak observation with the answer.
-- 12: prefill + bigger -> height rejected, direction kept.
-- 13: typed height + smaller, typed above the shown height -> kept, counts as a conflict.
-- 14: prefill, no answer -> rejected exactly as before.
INSERT INTO public.sessions (id, user_id, beach_id, arrival_time, status, wave_height_ft, wave_height_source, wave_size_vs_forecast, forecast_wave_height_ft)
VALUES
  (fixture_id(11), fixture_id(1), fixture_id(100), '2026-10-21 16:30+00', 'completed', 2.5, 'forecast_prefill', 'about_right', 2.8),
  (fixture_id(12), fixture_id(1), fixture_id(100), '2026-10-21 16:30+00', 'completed', 2.5, 'forecast_prefill', 'bigger', 2.8),
  (fixture_id(13), fixture_id(1), fixture_id(100), '2026-10-21 16:30+00', 'completed', 3.5, 'user', 'smaller', 2.8),
  (fixture_id(14), fixture_id(1), fixture_id(100), '2026-10-21 16:30+00', 'completed', 2.5, 'forecast_prefill', NULL, 2.8);

SELECT assert_equal('confirmed prefill state', quality_state, 'weak'),
       assert_equal('confirmed prefill reason', rejection_reason, NULL::text),
       assert_equal('confirmed prefill observed_m', observed_m, 0.762),
       assert_equal('confirmed prefill answer', reported_size_vs_forecast, 'about_right'),
       assert_equal('confirmed prefill shown', shown_forecast_height_ft, 2.8::numeric),
       assert_equal('confirmed prefill matched', ml_prediction_id IS NOT NULL, true)
FROM public.session_wave_observation_candidates WHERE session_id = fixture_id(11);

SELECT assert_equal('direction-only prefill state', quality_state, 'rejected'),
       assert_equal('direction-only prefill reason', rejection_reason, 'forecast_prefilled_wave_height'),
       assert_equal('direction-only prefill observed_m', observed_m, NULL::numeric),
       assert_equal('direction-only prefill answer', reported_size_vs_forecast, 'bigger'),
       assert_equal('direction-only prefill shown', shown_forecast_height_ft, 2.8::numeric)
FROM public.session_wave_observation_candidates WHERE session_id = fixture_id(12);

SELECT assert_equal('typed height state', quality_state, 'weak'),
       assert_equal('typed height answer', reported_size_vs_forecast, 'smaller'),
       assert_equal('typed height observed_m', observed_m, 1.067)
FROM public.session_wave_observation_candidates WHERE session_id = fixture_id(13);

SELECT assert_equal('unanswered prefill state', quality_state, 'rejected'),
       assert_equal('unanswered prefill reason', rejection_reason, 'forecast_prefilled_wave_height'),
       assert_equal('unanswered prefill answer', reported_size_vs_forecast, NULL::text)
FROM public.session_wave_observation_candidates WHERE session_id = fixture_id(14);

-- Answering later on the edit screen re-syncs through the snapshot trigger's column list.
UPDATE public.sessions SET wave_size_vs_forecast = 'about_right' WHERE id = fixture_id(14);
SELECT assert_equal('edited answer state', quality_state, 'weak'),
       assert_equal('edited answer reason', rejection_reason, NULL::text),
       assert_equal('edited answer value', reported_size_vs_forecast, 'about_right')
FROM public.session_wave_observation_candidates WHERE session_id = fixture_id(14);

UPDATE public.sessions SET forecast_wave_height_ft = 3.1 WHERE id = fixture_id(14);
SELECT assert_equal('edited shown height', shown_forecast_height_ft, 3.1::numeric)
FROM public.session_wave_observation_candidates WHERE session_id = fixture_id(14);

-- A session that never completed still gets no candidate.
INSERT INTO public.sessions (id, user_id, beach_id, arrival_time, status, wave_height_ft, wave_size_vs_forecast)
VALUES (fixture_id(15), fixture_id(1), fixture_id(100), '2026-10-21 16:30+00', 'planned', 2.5, 'bigger');
SELECT assert_equal(
  'planned session has no candidate',
  (SELECT count(*) FROM public.session_wave_observation_candidates WHERE session_id = fixture_id(15)),
  0::bigint
);

DO $$
BEGIN
  INSERT INTO public.sessions (id, user_id, beach_id, arrival_time, status, wave_height_ft, wave_size_vs_forecast)
  VALUES (fixture_id(16), fixture_id(1), fixture_id(100), now(), 'completed', 2, 'huge');
  RAISE EXCEPTION 'CHECK accepted an unknown answer';
EXCEPTION WHEN check_violation THEN
  NULL;
END;
$$;

SELECT assert_equal('answers', (a->'size_vs_forecast'->>'answers')::int, 4),
       assert_equal('about_right answers', (a->'size_vs_forecast'->'by_answer'->>'about_right')::int, 2),
       assert_equal('bigger answers', (a->'size_vs_forecast'->'by_answer'->>'bigger')::int, 1),
       assert_equal('smaller answers', (a->'size_vs_forecast'->'by_answer'->>'smaller')::int, 1),
       assert_equal('with shown height', (a->'size_vs_forecast'->>'with_shown_height')::int, 4),
       assert_equal('confirmed prefills', (a->'size_vs_forecast'->>'confirmed_prefills')::int, 2),
       assert_equal('direction-only prefills', (a->'size_vs_forecast'->>'direction_only_prefills')::int, 1),
       assert_equal('height/answer conflicts', (a->'size_vs_forecast'->>'height_answer_conflicts')::int, 1),
       assert_equal('existing funnel kept', (a->'funnel'->>'candidate_rows')::int, 4)
FROM (SELECT public.get_session_wave_observation_analytics() AS a) analytics;

SELECT assert_equal(
  'authenticated cannot run the sync',
  has_function_privilege('authenticated', 'public.sync_session_wave_observation_candidate(uuid, uuid, uuid, timestamptz, text, numeric, text)', 'EXECUTE'),
  false
),
assert_equal(
  'service_role runs the sync',
  has_function_privilege('service_role', 'public.sync_session_wave_observation_candidate(uuid, uuid, uuid, timestamptz, text, numeric, text)', 'EXECUTE'),
  true
),
assert_equal(
  'authenticated cannot read analytics',
  has_function_privilege('authenticated', 'public.get_session_wave_observation_analytics()', 'EXECUTE'),
  false
);

\echo 'session_wave_size_vs_forecast: all assertions passed'
