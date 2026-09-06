-- Phase 26 D-04/D-15: shadow-only, append-only evidence and event identity.
BEGIN;

CREATE TABLE public.swell_watch_observations (
  id uuid PRIMARY KEY,
  evaluation_id text NOT NULL CHECK (char_length(evaluation_id) BETWEEN 1 AND 200),
  source_point_id uuid NOT NULL REFERENCES public.beaches(id),
  provider text NOT NULL CHECK (provider IN ('noaa', 'open_meteo')),
  forecast_at timestamptz NOT NULL,
  source_slot text NOT NULL CHECK (source_slot IN ('s1', 's2')),
  height_m numeric NOT NULL CHECK (height_m >= 0 AND height_m NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
  period_s numeric NOT NULL CHECK (period_s > 0 AND period_s NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
  direction_deg numeric NOT NULL CHECK (direction_deg >= 0 AND direction_deg < 360),
  identity_kind text NOT NULL CHECK (identity_kind IN ('genuine_completed', 'synthetic_fixture')),
  observed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (evaluation_id, source_point_id, provider, forecast_at, source_slot)
);

CREATE TABLE public.swell_watch_beach_impacts (
  id uuid PRIMARY KEY,
  observation_id uuid NOT NULL REFERENCES public.swell_watch_observations(id),
  beach_id uuid NOT NULL REFERENCES public.beaches(id),
  evaluation_id text NOT NULL,
  projected_face_height_ft numeric NOT NULL CHECK (projected_face_height_ft >= 0 AND projected_face_height_ft NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
  policy_id text NOT NULL,
  policy_hash text NOT NULL CHECK (policy_hash ~ '^[a-f0-9]{64}$'),
  impact_hash text NOT NULL CHECK (impact_hash ~ '^[a-f0-9]{64}$'),
  evaluated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (observation_id, beach_id),
  UNIQUE (id, beach_id, evaluation_id)
);

CREATE TABLE public.swell_watch_regional_events (
  id uuid PRIMARY KEY,
  region_key text NOT NULL CHECK (char_length(region_key) BETWEEN 1 AND 100),
  physical_key text NOT NULL CHECK (char_length(physical_key) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

CREATE TABLE public.swell_watch_event_evaluations (
  id uuid PRIMARY KEY,
  regional_event_id uuid NOT NULL REFERENCES public.swell_watch_regional_events(id),
  evaluation_id text NOT NULL,
  identity_kind text NOT NULL CHECK (identity_kind IN ('genuine_completed', 'synthetic_fixture')),
  beach_impact_id uuid NOT NULL REFERENCES public.swell_watch_beach_impacts(id),
  arrival_at timestamptz NOT NULL,
  peak_at timestamptz NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (regional_event_id, evaluation_id)
);

CREATE TABLE public.swell_watch_event_state_transitions (
  id uuid PRIMARY KEY,
  regional_event_id uuid NOT NULL REFERENCES public.swell_watch_regional_events(id),
  state text NOT NULL CHECK (state IN ('candidate', 'stable', 'suppressed')),
  version integer NOT NULL CHECK (version > 0),
  trigger_evaluation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (regional_event_id, version)
);

-- One issuance confirms the regional event once; every destination keeps its own timing.
CREATE TABLE public.swell_watch_event_impacts (
  id uuid PRIMARY KEY,
  regional_event_id uuid NOT NULL REFERENCES public.swell_watch_regional_events(id),
  evaluation_id text NOT NULL,
  beach_id uuid NOT NULL REFERENCES public.beaches(id),
  beach_impact_id uuid NOT NULL REFERENCES public.swell_watch_beach_impacts(id),
  arrival_at timestamptz NOT NULL CHECK (isfinite(arrival_at)),
  peak_at timestamptz NOT NULL CHECK (isfinite(peak_at) AND peak_at >= arrival_at),
  evaluated_at timestamptz NOT NULL,
  UNIQUE (regional_event_id, evaluation_id, beach_id),
  FOREIGN KEY (regional_event_id, evaluation_id)
    REFERENCES public.swell_watch_event_evaluations(regional_event_id, evaluation_id),
  FOREIGN KEY (beach_impact_id, beach_id, evaluation_id)
    REFERENCES public.swell_watch_beach_impacts(id, beach_id, evaluation_id)
);

CREATE TABLE public.swell_watch_event_aliases (
  id uuid PRIMARY KEY,
  regional_event_id uuid NOT NULL REFERENCES public.swell_watch_regional_events(id),
  alias_key text NOT NULL CHECK (char_length(alias_key) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (regional_event_id, alias_key)
);

CREATE TABLE public.swell_watch_recipient_announcements (
  id uuid PRIMARY KEY,
  regional_event_id uuid NOT NULL REFERENCES public.swell_watch_regional_events(id),
  recipient_id uuid NOT NULL REFERENCES auth.users(id),
  claimed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (regional_event_id, recipient_id)
);

CREATE TABLE public.swell_watch_automation_control (
  id uuid PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('disabled', 'armed')),
  reason_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

CREATE OR REPLACE FUNCTION public.swell_watch_append_only_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'swell watch evidence is append-only';
  END IF;
  IF current_setting('app.swell_watch_internal_write', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'swell watch writes require a service transition';
  END IF;
  IF TG_TABLE_NAME = 'swell_watch_production_approval_authority' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control', 0));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER swell_watch_observations_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_observations FOR EACH ROW EXECUTE FUNCTION public.swell_watch_append_only_trigger();
CREATE TRIGGER swell_watch_beach_impacts_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_beach_impacts FOR EACH ROW EXECUTE FUNCTION public.swell_watch_append_only_trigger();
CREATE TRIGGER swell_watch_events_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_regional_events FOR EACH ROW EXECUTE FUNCTION public.swell_watch_append_only_trigger();
CREATE TRIGGER swell_watch_event_evaluations_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_event_evaluations FOR EACH ROW EXECUTE FUNCTION public.swell_watch_append_only_trigger();
CREATE TRIGGER swell_watch_event_impacts_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_event_impacts FOR EACH ROW EXECUTE FUNCTION public.swell_watch_append_only_trigger();
CREATE TRIGGER swell_watch_state_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_event_state_transitions FOR EACH ROW EXECUTE FUNCTION public.swell_watch_append_only_trigger();
CREATE TRIGGER swell_watch_aliases_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_event_aliases FOR EACH ROW EXECUTE FUNCTION public.swell_watch_append_only_trigger();
CREATE TRIGGER swell_watch_announcements_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_recipient_announcements FOR EACH ROW EXECUTE FUNCTION public.swell_watch_append_only_trigger();
CREATE TRIGGER swell_watch_control_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_automation_control FOR EACH ROW EXECUTE FUNCTION public.swell_watch_append_only_trigger();

CREATE OR REPLACE FUNCTION public.advance_swell_watch_event(
  p_regional_event_id uuid,
  p_evaluation_id text,
  p_beach_impact_id uuid,
  p_arrival_at timestamptz,
  p_peak_at timestamptz,
  p_transition_id uuid
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
  v_impact_evaluation_id text;
  v_impact_identity_kind text;
  v_latest_state text;
  v_latest_evaluation_id text;
  v_cycle_started_at timestamptz;
  v_version integer;
  v_transition_id uuid;
  v_existing_beach_impact_id uuid;
  v_existing_arrival_at timestamptz;
  v_existing_peak_at timestamptz;
  v_existing_evaluation_kind text;
  v_beach_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-event:' || p_regional_event_id::text, 0));
  PERFORM set_config('app.swell_watch_internal_write', 'on', true);
  SELECT impact.evaluation_id, observation.identity_kind, impact.beach_id
  INTO v_impact_evaluation_id, v_impact_identity_kind, v_beach_id
  FROM public.swell_watch_beach_impacts impact
  JOIN public.swell_watch_observations observation ON observation.id = impact.observation_id
  WHERE impact.id = p_beach_impact_id;
  IF v_impact_evaluation_id IS DISTINCT FROM p_evaluation_id THEN
    RAISE EXCEPTION 'evaluation identity does not match beach impact';
  END IF;
  IF v_impact_identity_kind NOT IN ('genuine_completed', 'synthetic_fixture') THEN
    RAISE EXCEPTION 'evaluation identity kind is invalid';
  END IF;
  IF p_arrival_at IS NULL OR p_peak_at IS NULL OR NOT isfinite(p_arrival_at)
    OR NOT isfinite(p_peak_at) OR p_peak_at < p_arrival_at THEN
    RAISE EXCEPTION 'invalid event impact timing';
  END IF;
  SELECT state INTO v_latest_state
  FROM public.swell_watch_event_state_transitions
  WHERE regional_event_id = p_regional_event_id
  ORDER BY version DESC
  LIMIT 1;
  IF v_latest_state = 'suppressed' THEN
    RETURN 'candidate';
  END IF;
  SELECT beach_impact_id, arrival_at, peak_at
  INTO v_existing_beach_impact_id, v_existing_arrival_at, v_existing_peak_at
  FROM public.swell_watch_event_impacts
  WHERE regional_event_id = p_regional_event_id AND evaluation_id = p_evaluation_id
    AND beach_id = v_beach_id;
  IF v_existing_beach_impact_id IS NOT NULL AND (
    v_existing_beach_impact_id IS DISTINCT FROM p_beach_impact_id
    OR v_existing_arrival_at IS DISTINCT FROM p_arrival_at
    OR v_existing_peak_at IS DISTINCT FROM p_peak_at
  ) THEN
    RAISE EXCEPTION 'conflicting event evaluation retry';
  END IF;
  IF v_existing_beach_impact_id IS NOT NULL THEN
    RETURN coalesce(v_latest_state, 'candidate');
  END IF;
  SELECT identity_kind INTO v_existing_evaluation_kind
  FROM public.swell_watch_event_evaluations
  WHERE regional_event_id = p_regional_event_id AND evaluation_id = p_evaluation_id;
  IF FOUND AND v_existing_evaluation_kind IS DISTINCT FROM v_impact_identity_kind THEN
    RAISE EXCEPTION 'conflicting event evaluation retry';
  END IF;
  INSERT INTO public.swell_watch_event_evaluations (id, regional_event_id, evaluation_id, identity_kind, beach_impact_id, arrival_at, peak_at)
  VALUES (p_transition_id, p_regional_event_id, p_evaluation_id, v_impact_identity_kind, p_beach_impact_id, p_arrival_at, p_peak_at)
  ON CONFLICT (regional_event_id, evaluation_id) DO NOTHING;
  INSERT INTO public.swell_watch_event_impacts
    (id, regional_event_id, evaluation_id, beach_id, beach_impact_id, arrival_at, peak_at, evaluated_at)
  SELECT gen_random_uuid(), p_regional_event_id, p_evaluation_id, v_beach_id,
    p_beach_impact_id, p_arrival_at, p_peak_at, evaluation.evaluated_at
  FROM public.swell_watch_event_evaluations evaluation
  WHERE evaluation.regional_event_id = p_regional_event_id AND evaluation.evaluation_id = p_evaluation_id;
  SELECT max(created_at) INTO v_cycle_started_at
  FROM public.swell_watch_event_state_transitions
  WHERE regional_event_id = p_regional_event_id AND state = 'suppressed';
  IF v_latest_state = 'stable' THEN
    RETURN 'stable';
  END IF;
  SELECT evaluation_id INTO v_latest_evaluation_id
  FROM public.swell_watch_event_evaluations
  WHERE regional_event_id = p_regional_event_id
    AND (v_cycle_started_at IS NULL OR evaluated_at > v_cycle_started_at)
  ORDER BY evaluated_at DESC, id DESC
  LIMIT 1;
  IF v_latest_evaluation_id IS DISTINCT FROM p_evaluation_id THEN
    RETURN 'candidate';
  END IF;
  SELECT count(*) INTO v_count FROM (
    SELECT evaluation_id
    FROM public.swell_watch_event_evaluations
    WHERE regional_event_id = p_regional_event_id
      AND (v_cycle_started_at IS NULL OR evaluated_at > v_cycle_started_at)
    ORDER BY evaluated_at DESC, id DESC
    LIMIT 2
  ) contiguous_evaluations;
  IF v_count < 2 THEN RETURN 'candidate'; END IF;
  SELECT coalesce(max(version), 0) + 1 INTO v_version FROM public.swell_watch_event_state_transitions WHERE regional_event_id = p_regional_event_id;
  INSERT INTO public.swell_watch_event_state_transitions (id, regional_event_id, state, version, trigger_evaluation_id)
  VALUES (gen_random_uuid(), p_regional_event_id, 'stable', v_version, p_evaluation_id)
  ON CONFLICT (regional_event_id, version) DO NOTHING
  RETURNING id INTO v_transition_id;
  IF v_transition_id IS NULL THEN
    SELECT state INTO v_latest_state
    FROM public.swell_watch_event_state_transitions
    WHERE regional_event_id = p_regional_event_id
    ORDER BY version DESC
    LIMIT 1;
    IF v_latest_state = 'suppressed' THEN RETURN 'candidate'; END IF;
  END IF;
  RETURN 'stable';
END;
$$;

CREATE OR REPLACE FUNCTION public.ingest_swell_watch_evaluation(
  p_observation_id uuid, p_impact_id uuid, p_regional_event_id uuid,
  p_evaluation_id text, p_source_point_id uuid, p_region_key text,
  p_physical_key text, p_provider text, p_forecast_at timestamptz,
  p_source_slot text, p_height_m numeric, p_period_s numeric,
  p_direction_deg numeric, p_projected_face_height_ft numeric,
  p_policy_id text, p_policy_hash text, p_impact_hash text, p_identity_kind text,
  p_arrival_at timestamptz, p_peak_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_observation_id uuid;
  v_impact_id uuid;
  v_regional_event_id uuid;
  v_existing_region_key text;
  v_existing_height_m numeric;
  v_existing_period_s numeric;
  v_existing_direction_deg numeric;
  v_existing_identity_kind text;
  v_existing_projected_face_height_ft numeric;
  v_existing_policy_id text;
  v_existing_policy_hash text;
  v_existing_impact_hash text;
BEGIN
  IF p_evaluation_id !~ '^(genuine_completed|synthetic_fixture):[^[:space:]]{1,180}$'
    OR p_identity_kind NOT IN ('genuine_completed', 'synthetic_fixture')
    OR split_part(p_evaluation_id, ':', 1) <> p_identity_kind
    OR p_policy_id = '' OR p_policy_hash !~ '^[a-f0-9]{64}$' OR p_impact_hash !~ '^[a-f0-9]{64}$'
    OR p_region_key = '' OR p_physical_key = ''
    OR p_provider NOT IN ('noaa', 'open_meteo') OR p_source_slot NOT IN ('s1', 's2')
    OR p_height_m < 0 OR p_period_s <= 0 OR p_direction_deg < 0 OR p_direction_deg >= 360
    OR p_projected_face_height_ft < 0 OR p_peak_at < p_arrival_at
    OR p_height_m IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
    OR p_period_s IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
    OR p_projected_face_height_ft IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric) THEN
    RAISE EXCEPTION 'invalid swell watch evaluation input';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-region:' || p_region_key, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'swell-watch-observation:' || p_evaluation_id || ':' || p_source_point_id::text || ':' || p_provider || ':' || p_forecast_at::text || ':' || p_source_slot,
    0
  ));
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-event:' || p_regional_event_id::text, 0));
  PERFORM set_config('app.swell_watch_internal_write', 'on', true);
  SELECT id, region_key INTO v_regional_event_id, v_existing_region_key
  FROM public.swell_watch_regional_events
  WHERE id = p_regional_event_id;
  IF v_regional_event_id IS NOT NULL AND v_existing_region_key IS DISTINCT FROM p_region_key THEN
    RAISE EXCEPTION 'regional event identity does not match region';
  END IF;
  IF v_regional_event_id IS NULL THEN
    SELECT evaluation.regional_event_id INTO v_regional_event_id
    FROM public.swell_watch_event_impacts evaluation
    JOIN public.swell_watch_regional_events event ON event.id = evaluation.regional_event_id
    JOIN public.swell_watch_beach_impacts impact ON impact.id = evaluation.beach_impact_id
    JOIN public.swell_watch_observations observation ON observation.id = impact.observation_id
    WHERE observation.evaluation_id = p_evaluation_id
      AND observation.source_point_id = p_source_point_id
      AND observation.provider = p_provider
      AND observation.forecast_at = p_forecast_at
      AND observation.source_slot = p_source_slot
      AND event.region_key = p_region_key
    ORDER BY evaluation.evaluated_at DESC
    LIMIT 1;
  END IF;
  IF v_regional_event_id IS NULL THEN
    INSERT INTO public.swell_watch_regional_events (id, region_key, physical_key)
    VALUES (p_regional_event_id, p_region_key, p_physical_key)
    RETURNING id INTO v_regional_event_id;
  END IF;
  IF v_regional_event_id IS DISTINCT FROM p_regional_event_id THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-event:' || v_regional_event_id::text, 0));
  END IF;
  INSERT INTO public.swell_watch_event_aliases (id, regional_event_id, alias_key)
  VALUES (gen_random_uuid(), v_regional_event_id, p_physical_key)
  ON CONFLICT (regional_event_id, alias_key) DO NOTHING;
  INSERT INTO public.swell_watch_observations (id, evaluation_id, source_point_id, provider, forecast_at, source_slot, height_m, period_s, direction_deg, identity_kind)
  VALUES (p_observation_id, p_evaluation_id, p_source_point_id, p_provider, p_forecast_at, p_source_slot, p_height_m, p_period_s, p_direction_deg, p_identity_kind)
  ON CONFLICT (evaluation_id, source_point_id, provider, forecast_at, source_slot) DO NOTHING
  RETURNING id INTO v_observation_id;
  IF v_observation_id IS NULL THEN
    SELECT id, height_m, period_s, direction_deg, identity_kind
    INTO v_observation_id, v_existing_height_m, v_existing_period_s, v_existing_direction_deg, v_existing_identity_kind
    FROM public.swell_watch_observations
    WHERE evaluation_id = p_evaluation_id AND source_point_id = p_source_point_id AND provider = p_provider
      AND forecast_at = p_forecast_at AND source_slot = p_source_slot;
    IF v_existing_height_m IS DISTINCT FROM p_height_m
      OR v_existing_period_s IS DISTINCT FROM p_period_s
      OR v_existing_direction_deg IS DISTINCT FROM p_direction_deg
      OR v_existing_identity_kind IS DISTINCT FROM p_identity_kind THEN
      RAISE EXCEPTION 'conflicting observation retry';
    END IF;
  END IF;
  INSERT INTO public.swell_watch_beach_impacts (id, observation_id, beach_id, evaluation_id, projected_face_height_ft, policy_id, policy_hash, impact_hash)
  VALUES (p_impact_id, v_observation_id, p_source_point_id, p_evaluation_id, p_projected_face_height_ft, p_policy_id, p_policy_hash, p_impact_hash)
  ON CONFLICT (observation_id, beach_id) DO NOTHING
  RETURNING id INTO v_impact_id;
  IF v_impact_id IS NULL THEN
    SELECT id, projected_face_height_ft, policy_id, policy_hash, impact_hash
    INTO v_impact_id, v_existing_projected_face_height_ft, v_existing_policy_id, v_existing_policy_hash, v_existing_impact_hash
    FROM public.swell_watch_beach_impacts
    WHERE observation_id = v_observation_id AND beach_id = p_source_point_id;
    IF v_existing_projected_face_height_ft IS DISTINCT FROM p_projected_face_height_ft
      OR v_existing_policy_id IS DISTINCT FROM p_policy_id
      OR v_existing_policy_hash IS DISTINCT FROM p_policy_hash
      OR v_existing_impact_hash IS DISTINCT FROM p_impact_hash THEN
      RAISE EXCEPTION 'conflicting impact retry';
    END IF;
  END IF;
  PERFORM public.advance_swell_watch_event(v_regional_event_id, p_evaluation_id, v_impact_id, p_arrival_at, p_peak_at, gen_random_uuid());
END;
$$;

CREATE OR REPLACE FUNCTION public.append_swell_watch_state_transition(
  p_transition_id uuid, p_regional_event_id uuid, p_expected_version integer,
  p_state text, p_evaluation_id text
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_current integer; v_next integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-event:' || p_regional_event_id::text, 0));
  SELECT coalesce(max(version), 0) INTO v_current FROM public.swell_watch_event_state_transitions WHERE regional_event_id = p_regional_event_id;
  IF v_current IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'swell watch transition version conflict'; END IF;
  IF p_state = 'stable' THEN RAISE EXCEPTION 'stable transitions require evidence advancement'; END IF;
  PERFORM set_config('app.swell_watch_internal_write', 'on', true);
  v_next := v_current + 1;
  INSERT INTO public.swell_watch_event_state_transitions (id, regional_event_id, state, version, trigger_evaluation_id) VALUES (p_transition_id, p_regional_event_id, p_state, v_next, p_evaluation_id);
  RETURN v_next;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_swell_watch_recipient_announcement(
  p_claim_id uuid,
  p_regional_event_id uuid,
  p_recipient_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-announcement:' || p_regional_event_id::text || ':' || p_recipient_id::text, 0));
  PERFORM set_config('app.swell_watch_internal_write', 'on', true);
  INSERT INTO public.swell_watch_recipient_announcements (id, regional_event_id, recipient_id)
  VALUES (p_claim_id, p_regional_event_id, p_recipient_id)
  ON CONFLICT (regional_event_id, recipient_id) DO NOTHING;
  RETURN FOUND;
END;
$$;

ALTER TABLE public.swell_watch_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_beach_impacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_regional_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_event_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_event_impacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.swell_watch_event_impacts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.swell_watch_event_impacts TO service_role;
ALTER TABLE public.swell_watch_event_state_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_event_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_recipient_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_automation_control ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.swell_watch_observations, public.swell_watch_beach_impacts, public.swell_watch_regional_events, public.swell_watch_event_evaluations, public.swell_watch_event_state_transitions, public.swell_watch_event_aliases, public.swell_watch_recipient_announcements, public.swell_watch_automation_control FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.swell_watch_observations, public.swell_watch_beach_impacts, public.swell_watch_regional_events, public.swell_watch_event_evaluations, public.swell_watch_event_state_transitions, public.swell_watch_event_aliases, public.swell_watch_recipient_announcements, public.swell_watch_automation_control FROM service_role;
GRANT SELECT ON public.swell_watch_observations, public.swell_watch_beach_impacts, public.swell_watch_regional_events, public.swell_watch_event_evaluations, public.swell_watch_event_state_transitions, public.swell_watch_event_aliases, public.swell_watch_recipient_announcements, public.swell_watch_automation_control TO service_role;
GRANT EXECUTE ON FUNCTION public.advance_swell_watch_event(uuid, text, uuid, timestamptz, timestamptz, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_swell_watch_recipient_announcement(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ingest_swell_watch_evaluation(uuid, uuid, uuid, text, uuid, text, text, text, timestamptz, text, numeric, numeric, numeric, numeric, text, text, text, text, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.append_swell_watch_state_transition(uuid, uuid, integer, text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.advance_swell_watch_event(uuid, text, uuid, timestamptz, timestamptz, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_swell_watch_recipient_announcement(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ingest_swell_watch_evaluation(uuid, uuid, uuid, text, uuid, text, text, text, timestamptz, text, numeric, numeric, numeric, numeric, text, text, text, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.append_swell_watch_state_transition(uuid, uuid, integer, text, text) FROM PUBLIC, anon, authenticated;

SELECT set_config('app.swell_watch_internal_write', 'on', true);
INSERT INTO public.swell_watch_automation_control (id, state, reason_code)
SELECT gen_random_uuid(), 'disabled', 'phase_26_initial_fail_closed'
WHERE NOT EXISTS (SELECT 1 FROM public.swell_watch_automation_control);

COMMIT;
