\set ON_ERROR_STOP on
-- Only the disposable cluster created by scripts/test-session-wave-height-source-postgres.sh.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;

CREATE TABLE public.sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  beach_id uuid NOT NULL,
  arrival_time timestamptz NOT NULL,
  status text,
  wave_height_ft numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
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
  observation_source text,
  quality_state text,
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

CREATE FUNCTION fixture_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;

CREATE FUNCTION submit_metadata(session_id uuid, prefilled jsonb, changed jsonb, web boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'event_id', 'session:' || session_id || CASE WHEN web THEN ':submit:web:v1' ELSE ':submit:v1' END,
    'session_id', session_id,
    'forecast_available', true,
    'forecast_prefilled', prefilled,
    'forecast_height_changed', changed
  )
$$;

INSERT INTO public.ml_predictions_log (beach_id, display_source, predicted_at, forecast_horizon_bucket, forecast_horizon_hours, raw_display_height_m)
VALUES (fixture_id(101), 'face-Hs-transformer-v1', '2026-10-01 15:00+00', '0-24h', 6, 0.9);

-- Rows that exist before the migration: a frozen prefill session whose event has
-- expired (weak candidate), and a session whose event says the surfer changed it.
INSERT INTO public.sessions (id, user_id, beach_id, arrival_time, status, wave_height_ft) VALUES
  ('fe61665c-c28f-43ff-a582-c97c6256a415', fixture_id(1), fixture_id(101), '2026-10-01 15:00+00', 'completed', 3),
  (fixture_id(11), fixture_id(1), fixture_id(101), '2026-10-01 15:00+00', 'completed', 4),
  (fixture_id(12), fixture_id(1), fixture_id(101), '2026-10-01 15:00+00', 'completed', 2.5);
INSERT INTO public.session_wave_observation_candidates (session_id, user_id, beach_id, observed_m, quality_state, observation_weight, reported_wave_height_ft)
VALUES ('fe61665c-c28f-43ff-a582-c97c6256a415', fixture_id(1), fixture_id(101), 0.914, 'weak', 0.2, 3),
       (fixture_id(11), fixture_id(1), fixture_id(101), 1.219, 'weak', 0.2, 4),
       (fixture_id(12), fixture_id(1), fixture_id(101), 0.762, 'weak', 0.2, 2.5);
INSERT INTO public.user_events (user_id, event_type, metadata) VALUES
  (fixture_id(1), 'session_log_submit', submit_metadata(fixture_id(11), 'false', 'true')),
  (fixture_id(1), 'session_log_submit', submit_metadata(fixture_id(12), 'true', 'false'));

\ir ../migrations/20261019100000_session_wave_height_source.sql

-- Production runs the sync from create_session_forecast_snapshot (AFTER INSERT/UPDATE OF
-- wave_height_ft, ...). Stand in for it so new rows reach the candidates table.
CREATE FUNCTION fixture_snapshot_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.sync_session_wave_observation_candidate(
    NEW.id, NEW.user_id, NEW.beach_id, NEW.arrival_time, NEW.status, NEW.wave_height_ft, 'trigger');
  RETURN NULL;
END;
$$;
CREATE TRIGGER fixture_snapshot AFTER INSERT OR UPDATE OF status, wave_height_ft ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION fixture_snapshot_trigger();

CREATE FUNCTION expect_source(p_session uuid, p_expected text, p_case text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual text;
BEGIN
  SELECT wave_height_source INTO actual FROM public.sessions WHERE id = p_session;
  IF actual IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION '%: expected wave_height_source %, got %', p_case, p_expected, actual;
  END IF;
END;
$$;

CREATE FUNCTION expect_candidate(p_session uuid, p_state text, p_reason text, p_case text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE c public.session_wave_observation_candidates%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.session_wave_observation_candidates WHERE session_id = p_session;
  IF c.quality_state IS DISTINCT FROM p_state OR c.rejection_reason IS DISTINCT FROM p_reason THEN
    RAISE EXCEPTION '%: expected candidate % / %, got % / %', p_case, p_state, p_reason, c.quality_state, c.rejection_reason;
  END IF;
  IF p_state = 'rejected' AND (c.observed_m IS NOT NULL OR c.observation_weight <> 0 OR c.reported_wave_height_ft IS NULL) THEN
    RAISE EXCEPTION '%: a rejected candidate keeps the reported height but carries no truth, got %', p_case, row_to_json(c);
  END IF;
END;
$$;

-- Backfill: the frozen list labels a session whose event is gone, events label the rest,
-- and an event outranks the frozen list.
SELECT expect_source('fe61665c-c28f-43ff-a582-c97c6256a415', 'forecast_prefill', 'frozen prefill');
SELECT expect_candidate('fe61665c-c28f-43ff-a582-c97c6256a415', 'rejected', 'forecast_prefilled_wave_height', 'frozen prefill');
SELECT expect_source(fixture_id(11), 'user', 'event says changed');
SELECT expect_candidate(fixture_id(11), 'weak', NULL, 'event says changed');
SELECT expect_source(fixture_id(12), 'forecast_prefill', 'event says prefilled');
SELECT expect_candidate(fixture_id(12), 'rejected', 'forecast_prefilled_wave_height', 'event says prefilled');

-- Native: the submit event usually lands before the session row.
INSERT INTO public.user_events (user_id, event_type, metadata)
VALUES (fixture_id(1), 'session_log_submit', submit_metadata(fixture_id(21), 'true', 'false'));
INSERT INTO public.sessions (id, user_id, beach_id, arrival_time, status, wave_height_ft)
VALUES (fixture_id(21), fixture_id(1), fixture_id(101), '2026-10-01 15:00+00', 'completed', 3);
SELECT expect_source(fixture_id(21), 'forecast_prefill', 'event first');
SELECT expect_candidate(fixture_id(21), 'rejected', 'forecast_prefilled_wave_height', 'event first');

-- Session row first, then the event: the label and the truth sync follow the event.
INSERT INTO public.sessions (id, user_id, beach_id, arrival_time, status, wave_height_ft)
VALUES (fixture_id(22), fixture_id(1), fixture_id(101), '2026-10-01 15:00+00', 'completed', 3);
SELECT expect_source(fixture_id(22), NULL, 'session first, before event');
SELECT expect_candidate(fixture_id(22), 'weak', NULL, 'session first, before event');
INSERT INTO public.user_events (user_id, event_type, metadata)
VALUES (fixture_id(1), 'session_log_submit', submit_metadata(fixture_id(22), 'true', 'false'));
SELECT expect_source(fixture_id(22), 'forecast_prefill', 'session first');
SELECT expect_candidate(fixture_id(22), 'rejected', 'forecast_prefilled_wave_height', 'session first');

-- Web saves first and its event_id carries :web:.
INSERT INTO public.sessions (id, user_id, beach_id, arrival_time, status, wave_height_ft)
VALUES (fixture_id(23), fixture_id(1), fixture_id(101), '2026-10-01 15:00+00', 'completed', 3.1);
INSERT INTO public.user_events (user_id, event_type, metadata)
VALUES (fixture_id(1), 'session_log_submit', submit_metadata(fixture_id(23), 'true', 'false', true));
SELECT expect_source(fixture_id(23), 'forecast_prefill', 'web');

-- A height the surfer chose stays truth, whichever arrives first.
INSERT INTO public.user_events (user_id, event_type, metadata)
VALUES (fixture_id(1), 'session_log_submit', submit_metadata(fixture_id(24), 'false', 'true'));
INSERT INTO public.sessions (id, user_id, beach_id, arrival_time, status, wave_height_ft)
VALUES (fixture_id(24), fixture_id(1), fixture_id(101), '2026-10-01 15:00+00', 'completed', 5);
SELECT expect_source(fixture_id(24), 'user', 'user changed it');
SELECT expect_candidate(fixture_id(24), 'weak', NULL, 'user changed it');

-- A client-supplied label is never overwritten by the event.
INSERT INTO public.sessions (id, user_id, beach_id, arrival_time, status, wave_height_ft, wave_height_source)
VALUES (fixture_id(25), fixture_id(1), fixture_id(101), '2026-10-01 15:00+00', 'completed', 3, 'user');
INSERT INTO public.user_events (user_id, event_type, metadata)
VALUES (fixture_id(1), 'session_log_submit', submit_metadata(fixture_id(25), 'true', 'false'));
SELECT expect_source(fixture_id(25), 'user', 'explicit label');

-- No forecast to prefill from: the height came from a deep link, not the forecast.
INSERT INTO public.user_events (user_id, event_type, metadata)
VALUES (fixture_id(1), 'session_log_submit',
  submit_metadata(fixture_id(26), 'true', 'false') || '{"forecast_available": false}'::jsonb);
INSERT INTO public.sessions (id, user_id, beach_id, arrival_time, status, wave_height_ft)
VALUES (fixture_id(26), fixture_id(1), fixture_id(101), '2026-10-01 15:00+00', 'completed', 3);
SELECT expect_source(fixture_id(26), 'user', 'no forecast available');

-- Another user's event cannot label the session.
INSERT INTO public.sessions (id, user_id, beach_id, arrival_time, status, wave_height_ft)
VALUES (fixture_id(27), fixture_id(1), fixture_id(101), '2026-10-01 15:00+00', 'completed', 3);
INSERT INTO public.user_events (user_id, event_type, metadata)
VALUES (fixture_id(2), 'session_log_submit', submit_metadata(fixture_id(27), 'true', 'false'));
SELECT expect_source(fixture_id(27), NULL, 'other user');
SELECT expect_candidate(fixture_id(27), 'weak', NULL, 'other user');

-- Malformed analytics never fails the insert and labels nothing.
INSERT INTO public.user_events (user_id, event_type, metadata) VALUES
  (fixture_id(1), 'session_log_submit', '{"session_id": "not-a-uuid", "forecast_prefilled": true}'),
  (fixture_id(1), 'session_log_submit', jsonb_build_object('session_id', fixture_id(28), 'forecast_prefilled', 'yes')),
  (fixture_id(1), 'session_log_submit', '"not an object"'),
  (fixture_id(1), 'session_log_submit', NULL),
  (NULL, 'session_log_submit', submit_metadata(fixture_id(28), 'true', 'false'));
INSERT INTO public.sessions (id, user_id, beach_id, arrival_time, status, wave_height_ft)
VALUES (fixture_id(28), fixture_id(1), fixture_id(101), '2026-10-01 15:00+00', 'completed', 3);
SELECT expect_source(fixture_id(28), NULL, 'malformed events');

-- Sessions without a height (watch, imports) skip the lookup and stay unknown.
INSERT INTO public.user_events (user_id, event_type, metadata)
VALUES (fixture_id(1), 'session_log_submit', submit_metadata(fixture_id(29), 'true', 'false'));
INSERT INTO public.sessions (id, user_id, beach_id, arrival_time, status, wave_height_ft)
VALUES (fixture_id(29), fixture_id(1), fixture_id(101), '2026-10-01 15:00+00', 'completed', NULL);
SELECT expect_source(fixture_id(29), NULL, 'no height');
INSERT INTO public.sessions (id, user_id, beach_id, arrival_time, status, wave_height_ft)
VALUES (fixture_id(31), fixture_id(1), fixture_id(101), '2026-10-01 15:00+00', 'completed', NULL);
INSERT INTO public.user_events (user_id, event_type, metadata)
VALUES (fixture_id(1), 'session_log_submit', submit_metadata(fixture_id(31), 'false', 'true', true));
SELECT expect_source(fixture_id(31), NULL, 'no height, event second');

-- Other event types do not touch sessions.
INSERT INTO public.sessions (id, user_id, beach_id, arrival_time, status, wave_height_ft)
VALUES (fixture_id(30), fixture_id(1), fixture_id(101), '2026-10-01 15:00+00', 'completed', 3);
INSERT INTO public.user_events (user_id, event_type, metadata)
VALUES (fixture_id(1), 'session_log_start', submit_metadata(fixture_id(30), 'true', 'false'));
SELECT expect_source(fixture_id(30), NULL, 'other event type');

-- Editing a prefilled height makes it the surfer's and returns it to truth; a no-op
-- write of the same height does not.
UPDATE public.sessions SET wave_height_ft = 3 WHERE id = fixture_id(21);
SELECT expect_source(fixture_id(21), 'forecast_prefill', 'same height rewritten');
UPDATE public.sessions SET wave_height_ft = 6 WHERE id = fixture_id(22);
SELECT expect_source(fixture_id(22), 'user', 'edited prefill');
SELECT expect_candidate(fixture_id(22), 'weak', NULL, 'edited prefill');

DO $$
BEGIN
  BEGIN
    UPDATE public.sessions SET wave_height_source = 'buoy' WHERE id = fixture_id(30);
    RAISE EXCEPTION 'CHECK accepted an unknown wave_height_source';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END
$$;

-- Applying the migration again is a no-op.
\ir ../migrations/20261019100000_session_wave_height_source.sql
SELECT expect_source(fixture_id(12), 'forecast_prefill', 'reapply');
SELECT expect_source(fixture_id(24), 'user', 'reapply');
SELECT expect_candidate(fixture_id(24), 'weak', NULL, 'reapply');

\echo 'session wave height source: all checks passed'
