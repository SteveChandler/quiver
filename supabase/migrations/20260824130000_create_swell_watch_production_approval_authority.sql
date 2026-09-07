-- Phase 26 D-18/D-19: append-only, server-only Swell Watch authority/control.
BEGIN;

ALTER TABLE public.swell_watch_automation_control
  DROP CONSTRAINT IF EXISTS swell_watch_automation_control_state_check;
ALTER TABLE public.swell_watch_automation_control
  ADD CONSTRAINT swell_watch_automation_control_state_check
  CHECK (state IN ('disabled', 'shadow', 'armed', 'held'));

CREATE OR REPLACE FUNCTION public.swell_watch_production_policy_values_valid(p_values jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp
AS $$
DECLARE
  v_candidates numeric;
  v_recipients numeric;
  v_projected_sends numeric;
  v_window_minutes numeric;
  v_rate numeric;
  v_minimum_samples numeric;
  v_forecast_age_hours numeric;
BEGIN
  IF jsonb_typeof(p_values) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_values #> '{volume_caps,maximum_candidates_per_region}') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_values #> '{volume_caps,maximum_recipients_per_event}') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_values #> '{volume_caps,maximum_projected_sends_per_window}') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_values #> '{provider_failure_hold,window_minutes}') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_values #> '{provider_failure_hold,maximum_failure_rate}') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_values #> '{provider_failure_hold,minimum_samples}') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_values #> '{staleness,maximum_forecast_age_hours}') IS DISTINCT FROM 'number'
    OR (p_values #>> '{volume_caps,maximum_candidates_per_region}') IS NULL
    OR (p_values #>> '{volume_caps,maximum_candidates_per_region}') !~ '^[0-9]+([.][0-9]+)?$'
    OR (p_values #>> '{volume_caps,maximum_recipients_per_event}') IS NULL
    OR (p_values #>> '{volume_caps,maximum_recipients_per_event}') !~ '^[0-9]+([.][0-9]+)?$'
    OR (p_values #>> '{volume_caps,maximum_projected_sends_per_window}') IS NULL
    OR (p_values #>> '{volume_caps,maximum_projected_sends_per_window}') !~ '^[0-9]+([.][0-9]+)?$'
    OR (p_values #>> '{provider_failure_hold,window_minutes}') IS NULL
    OR (p_values #>> '{provider_failure_hold,window_minutes}') !~ '^[0-9]+([.][0-9]+)?$'
    OR (p_values #>> '{provider_failure_hold,maximum_failure_rate}') IS NULL
    OR (p_values #>> '{provider_failure_hold,maximum_failure_rate}') !~ '^(0([.][0-9]+)?|1([.]0+)?)$'
    OR (p_values #>> '{provider_failure_hold,minimum_samples}') IS NULL
    OR (p_values #>> '{provider_failure_hold,minimum_samples}') !~ '^[1-9][0-9]*$'
    OR (p_values #>> '{staleness,maximum_forecast_age_hours}') IS NULL
    OR (p_values #>> '{staleness,maximum_forecast_age_hours}') !~ '^[0-9]+([.][0-9]+)?$' THEN
    RETURN false;
  END IF;
  v_candidates := (p_values #>> '{volume_caps,maximum_candidates_per_region}')::numeric;
  v_recipients := (p_values #>> '{volume_caps,maximum_recipients_per_event}')::numeric;
  v_projected_sends := (p_values #>> '{volume_caps,maximum_projected_sends_per_window}')::numeric;
  v_window_minutes := (p_values #>> '{provider_failure_hold,window_minutes}')::numeric;
  v_rate := (p_values #>> '{provider_failure_hold,maximum_failure_rate}')::numeric;
  v_minimum_samples := (p_values #>> '{provider_failure_hold,minimum_samples}')::numeric;
  v_forecast_age_hours := (p_values #>> '{staleness,maximum_forecast_age_hours}')::numeric;
  RETURN v_candidates > 0
    AND v_recipients > 0
    AND v_projected_sends > 0
    AND v_window_minutes > 0
    AND v_rate > 0 AND v_rate <= 1
    AND v_minimum_samples >= 1 AND trunc(v_minimum_samples) = v_minimum_samples
    AND v_forecast_age_hours > 0;
EXCEPTION WHEN numeric_value_out_of_range OR invalid_text_representation THEN
  RETURN false;
END;
$$;

CREATE TABLE public.swell_watch_production_approval_authority (
  record_id uuid PRIMARY KEY,
  authority_id uuid NOT NULL,
  authority_epoch integer NOT NULL CHECK (authority_epoch > 0),
  state text NOT NULL CHECK (state IN ('active', 'revoked', 'superseded')),
  revokes_authority_id uuid NULL,
  policy_hash text NOT NULL CHECK (policy_hash ~ '^[a-f0-9]{64}$'),
  policy_provenance text NOT NULL CHECK (policy_provenance = 'production_approved'),
  policy_values jsonb NOT NULL CHECK (public.swell_watch_production_policy_values_valid(policy_values)),
  approval_id text NOT NULL CHECK (char_length(approval_id) BETWEEN 1 AND 200),
  approval_evidence_hash text NOT NULL CHECK (approval_evidence_hash ~ '^[a-f0-9]{64}$'),
  production_scope text NOT NULL CHECK (production_scope = 'swell_watch_push'),
  reviewer text NOT NULL CHECK (char_length(reviewer) BETWEEN 1 AND 200),
  not_before timestamptz NOT NULL CHECK (isfinite(not_before)),
  expires_at timestamptz NOT NULL CHECK (isfinite(expires_at) AND expires_at > not_before),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (authority_epoch),
  CHECK (
    (state = 'active' AND revokes_authority_id IS NULL)
    OR (state IN ('revoked', 'superseded') AND revokes_authority_id IS NOT NULL)
  )
);

CREATE TABLE public.swell_watch_automation_control_transitions (
  id uuid PRIMARY KEY,
  operation text NOT NULL CHECK (operation IN ('hold', 'reset_shadow', 'arm')),
  state text NOT NULL CHECK (state IN ('shadow', 'armed', 'held')),
  epoch integer NOT NULL CHECK (epoch > 0),
  expected_epoch integer NOT NULL CHECK (expected_epoch >= 0),
  reason_code text NOT NULL CHECK (reason_code ~ '^[a-z0-9_:-]{3,96}$'),
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9:_-]{8,160}$'),
  actor_user_id uuid NULL REFERENCES auth.users(id),
  actor_kind text NOT NULL DEFAULT 'operator' CHECK (actor_kind IN ('operator', 'system')),
  system_actor text NULL CHECK (system_actor IS NULL OR system_actor = 'swell_watch_provider_monitor'),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (epoch),
  UNIQUE (idempotency_key),
  CHECK (
    (actor_kind = 'operator' AND actor_user_id IS NOT NULL AND system_actor IS NULL)
    OR (actor_kind = 'system' AND actor_user_id IS NULL AND system_actor IS NOT DISTINCT FROM 'swell_watch_provider_monitor')
  )
);

CREATE TRIGGER swell_watch_production_authority_append_only
  BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_production_approval_authority
  FOR EACH ROW EXECUTE FUNCTION public.swell_watch_append_only_trigger();
CREATE TRIGGER swell_watch_control_transitions_append_only
  BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_automation_control_transitions
  FOR EACH ROW EXECUTE FUNCTION public.swell_watch_append_only_trigger();

ALTER TABLE public.swell_watch_production_approval_authority ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_automation_control_transitions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.swell_watch_production_approval_authority, public.swell_watch_automation_control_transitions FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.swell_watch_get_automation_control()
RETURNS TABLE(state text, epoch integer, reason_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT transition.state, transition.epoch, transition.reason_code
  FROM public.swell_watch_automation_control_transitions transition
  ORDER BY transition.epoch DESC
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT control.state, 0, control.reason_code
  FROM public.swell_watch_automation_control control
  ORDER BY control.created_at DESC, control.id DESC
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.swell_watch_get_production_authority()
RETURNS TABLE(
  policy_hash text,
  policy_provenance text,
  policy_values jsonb,
  approval_id text,
  approval_evidence_hash text,
  production_scope text,
  reviewer text,
  not_before timestamptz,
  expires_at timestamptz,
  authority_epoch integer,
  authority_id uuid,
  revoked_at timestamptz,
  superseded_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    authority.policy_hash,
    authority.policy_provenance,
    authority.policy_values,
    authority.approval_id,
    authority.approval_evidence_hash,
    authority.production_scope,
    authority.reviewer,
    authority.not_before,
    authority.expires_at,
    authority.authority_epoch,
    authority.authority_id,
    revoke.created_at AS revoked_at,
    supersede.created_at AS superseded_at
  FROM public.swell_watch_production_approval_authority authority
  LEFT JOIN LATERAL (
    SELECT record.created_at
    FROM public.swell_watch_production_approval_authority record
    WHERE record.state = 'revoked'
      AND record.revokes_authority_id = authority.authority_id
    ORDER BY record.authority_epoch DESC
    LIMIT 1
  ) revoke ON true
  LEFT JOIN LATERAL (
    SELECT record.created_at
    FROM public.swell_watch_production_approval_authority record
    WHERE record.state = 'superseded'
      AND record.revokes_authority_id = authority.authority_id
    ORDER BY record.authority_epoch DESC
    LIMIT 1
  ) supersede ON true
  WHERE authority.state = 'active'
  ORDER BY authority.authority_epoch DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.transition_swell_watch_automation_control(
  p_operation text,
  p_expected_epoch integer,
  p_reason_code text,
  p_idempotency_key text,
  p_actor_user_id uuid,
  p_system_actor text DEFAULT NULL
)
RETURNS TABLE(state text, epoch integer, reason_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_state text;
  v_current_epoch integer;
  v_next_state text;
  v_existing public.swell_watch_automation_control_transitions%ROWTYPE;
  v_authority_exists boolean;
BEGIN
  IF p_operation NOT IN ('hold', 'reset_shadow', 'arm')
    OR p_expected_epoch < 0
    OR p_reason_code !~ '^[a-z0-9_:-]{3,96}$'
    OR p_idempotency_key !~ '^[A-Za-z0-9:_-]{8,160}$'
    OR (p_actor_user_id IS NULL AND (p_operation IS DISTINCT FROM 'hold' OR p_system_actor IS DISTINCT FROM 'swell_watch_provider_monitor'))
    OR (p_actor_user_id IS NOT NULL AND p_system_actor IS NOT NULL) THEN
    RAISE EXCEPTION 'invalid swell watch control transition' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control', 0));
  SELECT * INTO v_existing
  FROM public.swell_watch_automation_control_transitions
  WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.operation IS DISTINCT FROM p_operation
      OR v_existing.expected_epoch IS DISTINCT FROM p_expected_epoch
      OR v_existing.reason_code IS DISTINCT FROM p_reason_code
      OR v_existing.actor_user_id IS DISTINCT FROM p_actor_user_id
      OR v_existing.system_actor IS DISTINCT FROM p_system_actor THEN
      RAISE EXCEPTION 'conflicting swell watch control replay' USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT v_existing.state, v_existing.epoch, v_existing.reason_code;
    RETURN;
  END IF;

  SELECT resolved.state, resolved.epoch INTO v_current_state, v_current_epoch
  FROM public.swell_watch_get_automation_control() resolved;
  IF v_current_epoch IS NULL THEN
    RAISE EXCEPTION 'swell watch control unavailable' USING ERRCODE = 'P0001';
  END IF;
  IF v_current_epoch IS DISTINCT FROM p_expected_epoch THEN
    RAISE EXCEPTION 'swell watch control epoch conflict' USING ERRCODE = '40001';
  END IF;

  v_next_state := CASE p_operation
    WHEN 'hold' THEN 'held'
    WHEN 'reset_shadow' THEN 'shadow'
    WHEN 'arm' THEN 'armed'
  END;
  IF p_operation = 'reset_shadow' AND v_current_state <> 'held' THEN
    RAISE EXCEPTION 'only held control may reset to shadow' USING ERRCODE = '22023';
  END IF;
  IF p_operation = 'arm' THEN
    IF v_current_state <> 'shadow' THEN
      RAISE EXCEPTION 'only shadow control may arm' USING ERRCODE = '22023';
    END IF;
    SELECT authority.not_before <= transaction_timestamp()
      AND authority.expires_at > transaction_timestamp()
      AND NOT EXISTS (
        SELECT 1 FROM public.swell_watch_production_approval_authority revoked
        WHERE revoked.state IN ('revoked', 'superseded')
          AND revoked.revokes_authority_id = authority.authority_id
      )
    INTO v_authority_exists
    FROM public.swell_watch_production_approval_authority authority
    WHERE authority.state = 'active'
      AND authority.production_scope = 'swell_watch_push'
      AND isfinite(authority.not_before)
      AND isfinite(authority.expires_at)
    ORDER BY authority.authority_epoch DESC
    LIMIT 1;
    IF v_authority_exists IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'production approval authority unavailable' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  PERFORM set_config('app.swell_watch_internal_write', 'on', true);
  INSERT INTO public.swell_watch_automation_control_transitions (
    id, operation, state, epoch, expected_epoch, reason_code, idempotency_key, actor_user_id, actor_kind, system_actor
  ) VALUES (
    gen_random_uuid(), p_operation, v_next_state, v_current_epoch + 1,
    p_expected_epoch, p_reason_code, p_idempotency_key, p_actor_user_id,
    CASE WHEN p_actor_user_id IS NULL THEN 'system' ELSE 'operator' END, p_system_actor
  );
  RETURN QUERY SELECT v_next_state, v_current_epoch + 1, p_reason_code;
END;
$$;

ALTER TABLE public.swell_watch_recipient_announcements
  ADD COLUMN IF NOT EXISTS notification_event_id uuid NULL REFERENCES public.notification_events(id);
CREATE UNIQUE INDEX IF NOT EXISTS swell_watch_recipient_announcements_notification_event_idx
  ON public.swell_watch_recipient_announcements (notification_event_id)
  WHERE notification_event_id IS NOT NULL;

CREATE TABLE public.swell_watch_notification_event_bindings (
  notification_event_id uuid PRIMARY KEY REFERENCES public.notification_events(id),
  regional_event_id uuid NOT NULL REFERENCES public.swell_watch_regional_events(id),
  beach_id uuid NOT NULL REFERENCES public.beaches(id),
  recipient_id uuid NOT NULL REFERENCES auth.users(id),
  control_epoch integer NOT NULL CHECK (control_epoch > 0),
  authority_id uuid NOT NULL,
  authority_epoch integer NOT NULL CHECK (authority_epoch > 0),
  policy_hash text NOT NULL CHECK (policy_hash ~ '^[a-f0-9]{64}$'),
  approval_evidence_hash text NOT NULL CHECK (approval_evidence_hash ~ '^[a-f0-9]{64}$'),
  policy_provenance text NOT NULL CHECK (policy_provenance = 'production_approved'),
  policy_values jsonb NOT NULL CHECK (public.swell_watch_production_policy_values_valid(policy_values)),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE TABLE public.swell_watch_provider_delivery_outcomes (
  id uuid PRIMARY KEY,
  notification_event_id uuid NOT NULL REFERENCES public.notification_events(id),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  sample_count integer NOT NULL CHECK (sample_count BETWEEN 1 AND 1000),
  failure_count integer NOT NULL CHECK (failure_count BETWEEN 0 AND sample_count),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (notification_event_id, attempt_number)
);
CREATE TRIGGER swell_watch_notification_event_bindings_append_only
  BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_notification_event_bindings
  FOR EACH ROW EXECUTE FUNCTION public.swell_watch_append_only_trigger();
CREATE TRIGGER swell_watch_provider_delivery_outcomes_append_only
  BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_provider_delivery_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.swell_watch_append_only_trigger();
ALTER TABLE public.swell_watch_notification_event_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_provider_delivery_outcomes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.swell_watch_notification_event_bindings, public.swell_watch_provider_delivery_outcomes FROM PUBLIC, anon, authenticated, service_role;

-- ponytail: global control lock serializes reservations; partition only if throughput requires it.
CREATE FUNCTION public.swell_watch_projected_send_count(p_exclude uuid DEFAULT NULL)
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT count(*) FROM (
    SELECT notification_event_id, reservation_id, max(reserved_at) AS reserved_at FROM (
      SELECT notification_event_id, notification_event_id AS reservation_id, created_at AS reserved_at
      FROM public.swell_watch_notification_event_bindings
      UNION ALL
      SELECT notification_event_id, coalesce(notification_event_id, id), claimed_at
      FROM public.swell_watch_recipient_announcements
    ) history GROUP BY notification_event_id, reservation_id
  ) reservation
  LEFT JOIN public.notification_events queued ON queued.id = reservation.notification_event_id
  WHERE (p_exclude IS NULL OR reservation.notification_event_id IS DISTINCT FROM p_exclude)
    AND (reservation.reserved_at > clock_timestamp() - interval '24 hours'
      OR queued.id IS NULL OR queued.status IN ('pending', 'processing')
      OR EXISTS (SELECT 1 FROM public.swell_watch_provider_delivery_outcomes outcome
        WHERE outcome.notification_event_id = reservation.notification_event_id
          AND outcome.created_at > clock_timestamp() - interval '24 hours'));
$$;
REVOKE ALL ON FUNCTION public.swell_watch_projected_send_count(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.swell_watch_validate_notification_release(
  p_regional_event_id uuid,
  p_beach_id uuid,
  p_recipient_id uuid,
  p_forecast_at timestamptz,
  p_notification_event_id uuid
)
RETURNS TABLE(allowed boolean, reason_code text, control_epoch integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_control_state text;
  v_control_epoch integer;
  v_policy_hash text;
  v_authority_policy_hash text;
  v_authority_evidence_hash text;
  v_authority_provenance text;
  v_authority_values jsonb;
  v_authority_id uuid;
  v_authority_epoch integer;
  v_authority_valid boolean;
  v_maximum_forecast_age_hours numeric;
  v_event_state text;
  v_arrival_at timestamptz;
  v_observed_at timestamptz;
  v_relationship_active boolean;
  v_preferences_active boolean;
  v_active_device boolean;
  v_claimed boolean;
  v_queue_created_at timestamptz;
  v_binding public.swell_watch_notification_event_bindings%ROWTYPE;
  v_existing_receipt uuid;
BEGIN
  IF p_regional_event_id IS NULL OR p_beach_id IS NULL OR p_recipient_id IS NULL
    OR p_forecast_at IS NULL OR NOT isfinite(p_forecast_at) OR p_notification_event_id IS NULL THEN
    RETURN QUERY SELECT false, 'invalid_release_input', NULL::integer;
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control', 0));
  SELECT event.created_at INTO v_queue_created_at
  FROM public.notification_events event
  WHERE event.id = p_notification_event_id
    AND event.type = 'swell_watch'
    AND event.recipient_user_id = p_recipient_id
    AND event.payload ->> 'regional_event_id' = p_regional_event_id::text
    AND event.payload ->> 'beach_id' = p_beach_id::text
    AND (event.payload ->> 'forecast_at')::timestamptz = p_forecast_at;
  IF v_queue_created_at IS NULL THEN
    RETURN QUERY SELECT false, 'notification_binding_mismatch', NULL::integer;
    RETURN;
  END IF;
  SELECT control.state, control.epoch INTO v_control_state, v_control_epoch
  FROM public.swell_watch_get_automation_control() control;
  IF v_control_state IS DISTINCT FROM 'armed' THEN
    RETURN QUERY SELECT false, 'control_not_armed', v_control_epoch;
    RETURN;
  END IF;
  SELECT authority.policy_hash, authority.approval_evidence_hash, authority.policy_provenance,
    authority.policy_values, authority.authority_id, authority.authority_epoch,
    authority.not_before <= transaction_timestamp()
      AND authority.expires_at > transaction_timestamp()
      AND NOT EXISTS (
        SELECT 1 FROM public.swell_watch_production_approval_authority revoked
        WHERE revoked.state IN ('revoked', 'superseded')
          AND revoked.revokes_authority_id = authority.authority_id
      )
  INTO v_authority_policy_hash, v_authority_evidence_hash, v_authority_provenance,
    v_authority_values, v_authority_id, v_authority_epoch, v_authority_valid
  FROM public.swell_watch_production_approval_authority authority
  WHERE authority.state = 'active'
    AND authority.production_scope = 'swell_watch_push'
    AND isfinite(authority.not_before)
    AND isfinite(authority.expires_at)
  ORDER BY authority.authority_epoch DESC
  LIMIT 1;
  IF v_authority_policy_hash IS NULL
    OR v_authority_valid IS DISTINCT FROM true
    OR public.swell_watch_production_policy_values_valid(v_authority_values) IS DISTINCT FROM true THEN
    RETURN QUERY SELECT false, 'authority_unavailable', v_control_epoch;
    RETURN;
  END IF;
  v_maximum_forecast_age_hours :=
    (v_authority_values #>> '{staleness,maximum_forecast_age_hours}')::numeric;
  SELECT transition.state, impact.policy_hash, evaluation.arrival_at, observation.observed_at
  INTO v_event_state, v_policy_hash, v_arrival_at, v_observed_at
  FROM public.swell_watch_event_state_transitions transition
  JOIN public.swell_watch_event_impacts evaluation
    ON evaluation.regional_event_id = transition.regional_event_id
  JOIN public.swell_watch_beach_impacts impact ON impact.id = evaluation.beach_impact_id
  JOIN public.swell_watch_observations observation ON observation.id = impact.observation_id
  WHERE transition.regional_event_id = p_regional_event_id
    AND impact.beach_id = p_beach_id
  ORDER BY transition.version DESC, evaluation.evaluated_at DESC
  LIMIT 1;
  IF v_event_state IS DISTINCT FROM 'stable' OR v_policy_hash IS DISTINCT FROM v_authority_policy_hash
    OR v_arrival_at < transaction_timestamp() + interval '2 days'
    OR v_arrival_at > transaction_timestamp() + interval '5 days'
    OR v_observed_at < transaction_timestamp()
        - make_interval(secs => (v_maximum_forecast_age_hours * 3600)::double precision) THEN
    RETURN QUERY SELECT false, 'event_not_releasable', v_control_epoch;
    RETURN;
  END IF;
  IF p_forecast_at < transaction_timestamp()
      - make_interval(secs => (v_maximum_forecast_age_hours * 3600)::double precision) THEN
    RETURN QUERY SELECT false, 'forecast_stale', v_control_epoch;
    RETURN;
  END IF;
  SELECT * INTO v_binding
  FROM public.swell_watch_notification_event_bindings binding
  WHERE binding.notification_event_id = p_notification_event_id;
  IF FOUND THEN
    IF v_binding.regional_event_id <> p_regional_event_id
      OR v_binding.beach_id <> p_beach_id
      OR v_binding.recipient_id <> p_recipient_id
      OR v_binding.control_epoch <> v_control_epoch
      OR v_binding.authority_id <> v_authority_id
      OR v_binding.authority_epoch <> v_authority_epoch
      OR v_binding.policy_hash <> v_authority_policy_hash
      OR v_binding.approval_evidence_hash <> v_authority_evidence_hash
      OR v_binding.policy_provenance <> v_authority_provenance
      OR v_binding.policy_values <> v_authority_values THEN
      RETURN QUERY SELECT false, 'notification_binding_mismatch', v_control_epoch;
      RETURN;
    END IF;
  ELSE
    IF v_control_epoch IS NULL OR v_control_epoch < 1
      OR (SELECT state FROM public.swell_watch_automation_control_transitions
          WHERE created_at <= v_queue_created_at ORDER BY epoch DESC LIMIT 1) IS DISTINCT FROM 'armed'
      OR (SELECT epoch FROM public.swell_watch_automation_control_transitions
          WHERE created_at <= v_queue_created_at ORDER BY epoch DESC LIMIT 1) IS DISTINCT FROM v_control_epoch
      OR (SELECT authority.authority_id FROM public.swell_watch_production_approval_authority authority
          WHERE authority.state = 'active' AND authority.created_at <= v_queue_created_at
          ORDER BY authority.authority_epoch DESC LIMIT 1) IS DISTINCT FROM v_authority_id
      OR (SELECT authority.authority_epoch FROM public.swell_watch_production_approval_authority authority
          WHERE authority.state = 'active' AND authority.created_at <= v_queue_created_at
          ORDER BY authority.authority_epoch DESC LIMIT 1) IS DISTINCT FROM v_authority_epoch THEN
      RETURN QUERY SELECT false, 'notification_binding_mismatch', v_control_epoch;
      RETURN;
    END IF;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.profiles home
    WHERE home.id = p_recipient_id AND home.home_beach_id = p_beach_id
    UNION ALL
    SELECT 1 FROM public.favorite_beaches favorite
    WHERE favorite.user_id = p_recipient_id AND favorite.beach_id = p_beach_id
      AND favorite.alerts_enabled = true AND favorite.custom_spot_id IS NULL
    UNION ALL
    SELECT 1 FROM public.alert_rules rule
    WHERE rule.user_id = p_recipient_id AND rule.beach_id = p_beach_id
      AND rule.enabled = true AND rule.notify_push = true
  ) INTO v_relationship_active;
  SELECT profile.notif_push_enabled AND profile.notif_forecast_alerts
  INTO v_preferences_active
  FROM public.profiles profile WHERE profile.id = p_recipient_id;
  SELECT EXISTS (
    SELECT 1 FROM public.user_devices device
    WHERE device.user_id = p_recipient_id AND device.retired_at IS NULL
  ) INTO v_active_device;
  IF v_relationship_active IS DISTINCT FROM true
    OR v_preferences_active IS DISTINCT FROM true
    OR v_active_device IS DISTINCT FROM true THEN
    RETURN QUERY SELECT false, 'recipient_not_eligible', v_control_epoch;
    RETURN;
  END IF;
  PERFORM set_config('app.swell_watch_internal_write', 'on', true);
  SELECT notification_event_id INTO v_existing_receipt
  FROM public.swell_watch_recipient_announcements
  WHERE regional_event_id = p_regional_event_id AND recipient_id = p_recipient_id;
  IF FOUND AND v_existing_receipt IS DISTINCT FROM p_notification_event_id THEN
    RETURN QUERY SELECT false, 'recipient_deduplicated', v_control_epoch;
    RETURN;
  END IF;
  IF v_authority_values #> '{volume_caps,projected_send_window_hours}' IS DISTINCT FROM '24'::jsonb THEN
    RETURN QUERY SELECT false, 'authority_unavailable', v_control_epoch;
    RETURN;
  END IF;
  -- Retain unresolved claims; late delivery attempts restart their budget window.
  IF public.swell_watch_projected_send_count(p_notification_event_id) + 1
    > (v_authority_values #>> '{volume_caps,maximum_projected_sends_per_window}')::numeric THEN
    PERFORM * FROM public.transition_swell_watch_automation_control(
      'hold', v_control_epoch, 'projected_send_cap_exceeded',
      'projected-send-cap:' || v_control_epoch::text, NULL, 'swell_watch_provider_monitor'
    );
    RETURN QUERY SELECT false, 'projected_send_cap_exceeded', v_control_epoch + 1;
    RETURN;
  END IF;
  IF NOT FOUND THEN
    -- The control lock serializes release claims across workers and producers.
    IF (SELECT count(*) + 1 FROM (
        SELECT recipient_id FROM public.swell_watch_recipient_announcements WHERE regional_event_id = p_regional_event_id
        UNION
        SELECT recipient_id FROM public.swell_watch_notification_event_bindings WHERE regional_event_id = p_regional_event_id
      ) recipients WHERE recipient_id <> p_recipient_id)
      > (v_authority_values #>> '{volume_caps,maximum_recipients_per_event}')::numeric THEN
      PERFORM * FROM public.transition_swell_watch_automation_control(
        'hold', v_control_epoch, 'recipient_cap_exceeded',
        'recipient-cap:' || p_regional_event_id::text || ':' || v_control_epoch::text,
        NULL, 'swell_watch_provider_monitor'
      );
      RETURN QUERY SELECT false, 'recipient_cap_exceeded', v_control_epoch + 1;
      RETURN;
    END IF;
    INSERT INTO public.swell_watch_recipient_announcements (id, regional_event_id, recipient_id, notification_event_id)
    VALUES (gen_random_uuid(), p_regional_event_id, p_recipient_id, p_notification_event_id);
  END IF;
  IF v_binding.notification_event_id IS NULL THEN
    INSERT INTO public.swell_watch_notification_event_bindings (
      notification_event_id, regional_event_id, beach_id, recipient_id, control_epoch,
      authority_id, authority_epoch, policy_hash, approval_evidence_hash, policy_provenance, policy_values
    ) VALUES (
      p_notification_event_id, p_regional_event_id, p_beach_id, p_recipient_id, v_control_epoch,
      v_authority_id, v_authority_epoch, v_authority_policy_hash, v_authority_evidence_hash,
      v_authority_provenance, v_authority_values
    );
  END IF;
  RETURN QUERY SELECT true, 'allowed', v_control_epoch;
END;
$$;

CREATE OR REPLACE FUNCTION public.swell_watch_record_provider_delivery_outcome(
  p_notification_event_id uuid,
  p_attempt_number integer,
  p_sample_count integer,
  p_failure_count integer
)
RETURNS TABLE(held boolean, reason_code text, control_epoch integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_control_state text;
  v_control_epoch integer;
  v_values jsonb;
  v_window_minutes numeric;
  v_maximum_failure_rate numeric;
  v_minimum_samples integer;
  v_samples numeric;
  v_failures numeric;
  v_authority_valid boolean;
  v_existing_sample_count integer;
  v_existing_failure_count integer;
BEGIN
  IF p_notification_event_id IS NULL OR p_attempt_number < 1
    OR p_sample_count < 1 OR p_sample_count > 1000
    OR p_failure_count < 0 OR p_failure_count > p_sample_count THEN
    RAISE EXCEPTION 'invalid swell watch provider outcome' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control', 0));
  IF NOT EXISTS (
    SELECT 1 FROM public.notification_events event
    WHERE event.id = p_notification_event_id AND event.type = 'swell_watch'
  ) THEN
    RAISE EXCEPTION 'invalid swell watch provider outcome event' USING ERRCODE = '22023';
  END IF;
  SELECT state, epoch INTO v_control_state, v_control_epoch
  FROM public.swell_watch_get_automation_control();
  IF v_control_state IS DISTINCT FROM 'armed' THEN
    RETURN QUERY SELECT false, 'control_not_armed', v_control_epoch;
    RETURN;
  END IF;
  SELECT authority.policy_values,
    authority.not_before <= transaction_timestamp()
      AND authority.expires_at > transaction_timestamp()
      AND NOT EXISTS (
        SELECT 1 FROM public.swell_watch_production_approval_authority revoked
        WHERE revoked.state IN ('revoked', 'superseded')
          AND revoked.revokes_authority_id = authority.authority_id
      )
  INTO v_values, v_authority_valid
  FROM public.swell_watch_production_approval_authority authority
  WHERE authority.state = 'active'
    AND authority.production_scope = 'swell_watch_push'
    AND isfinite(authority.not_before)
    AND isfinite(authority.expires_at)
  ORDER BY authority.authority_epoch DESC
  LIMIT 1;
  IF v_authority_valid IS DISTINCT FROM true
    OR public.swell_watch_production_policy_values_valid(v_values) IS DISTINCT FROM true THEN
    RETURN QUERY SELECT false, 'authority_unavailable', v_control_epoch;
    RETURN;
  END IF;
  v_window_minutes := (v_values #>> '{provider_failure_hold,window_minutes}')::numeric;
  v_maximum_failure_rate := (v_values #>> '{provider_failure_hold,maximum_failure_rate}')::numeric;
  v_minimum_samples := (v_values #>> '{provider_failure_hold,minimum_samples}')::integer;
  PERFORM set_config('app.swell_watch_internal_write', 'on', true);
  SELECT sample_count, failure_count
  INTO v_existing_sample_count, v_existing_failure_count
  FROM public.swell_watch_provider_delivery_outcomes
  WHERE notification_event_id = p_notification_event_id
    AND attempt_number = p_attempt_number;
  IF FOUND THEN
    IF v_existing_sample_count IS DISTINCT FROM p_sample_count
      OR v_existing_failure_count IS DISTINCT FROM p_failure_count THEN
      RAISE EXCEPTION 'conflicting swell watch provider outcome replay' USING ERRCODE = '23505';
    END IF;
  ELSE
    INSERT INTO public.swell_watch_provider_delivery_outcomes (
      id, notification_event_id, attempt_number, sample_count, failure_count
    ) VALUES (
      gen_random_uuid(), p_notification_event_id, p_attempt_number, p_sample_count, p_failure_count
    );
  END IF;
  SELECT COALESCE(sum(sample_count), 0), COALESCE(sum(failure_count), 0)
  INTO v_samples, v_failures
  FROM public.swell_watch_provider_delivery_outcomes
  WHERE created_at >= transaction_timestamp() - make_interval(mins => v_window_minutes::integer);
  IF v_samples >= v_minimum_samples AND v_failures / v_samples > v_maximum_failure_rate THEN
    PERFORM * FROM public.transition_swell_watch_automation_control(
      'hold', v_control_epoch, 'provider_failure_rate',
      'swell-watch-provider-' || p_notification_event_id::text || '-' || p_attempt_number::text,
      NULL, 'swell_watch_provider_monitor'
    );
    RETURN QUERY SELECT true, 'provider_failure_rate', v_control_epoch + 1;
    RETURN;
  END IF;
  RETURN QUERY SELECT false, 'allowed', v_control_epoch;
END;
$$;

CREATE FUNCTION public.swell_watch_enqueue_notification(
  p_recipient_id uuid, p_payload jsonb, p_expected_epoch integer, p_policy_hash text
)
RETURNS TABLE(enqueued boolean, reason_code text, notification_event_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_state text;
  v_epoch integer;
  v_authority public.swell_watch_production_approval_authority%ROWTYPE;
  v_event_id uuid;
  v_beach_id uuid;
  v_forecast_at timestamptz;
  v_notification_id uuid;
BEGIN
  IF p_recipient_id IS NULL OR p_expected_epoch IS NULL OR p_expected_epoch < 1
    OR p_policy_hash IS NULL OR p_policy_hash !~ '^[a-f0-9]{64}$'
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR p_payload->>'type' IS DISTINCT FROM 'swell_watch'
    OR p_payload->>'schema_version' IS DISTINCT FROM 'swell-watch-notification.v2' THEN
    RETURN QUERY SELECT false, 'invalid_payload', NULL::uuid; RETURN;
  END IF;
  BEGIN
    v_event_id := (p_payload->>'regional_event_id')::uuid;
    v_beach_id := (p_payload->>'beach_id')::uuid;
    v_forecast_at := (p_payload->>'forecast_at')::timestamptz;
  EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
    RETURN QUERY SELECT false, 'invalid_payload', NULL::uuid; RETURN;
  END;
  IF v_event_id IS NULL OR v_beach_id IS NULL OR v_forecast_at IS NULL OR NOT isfinite(v_forecast_at) THEN
    RETURN QUERY SELECT false, 'invalid_payload', NULL::uuid; RETURN;
  END IF;
  IF jsonb_typeof(p_payload #> '{target_partition,height_m}') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_payload #> '{target_partition,period_s}') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_payload #> '{target_partition,direction_deg}') IS DISTINCT FROM 'number' THEN
    RETURN QUERY SELECT false, 'invalid_payload', NULL::uuid; RETURN;
  END IF;
  IF (p_payload #>> '{target_partition,height_m}')::numeric <= 0
    OR (p_payload #>> '{target_partition,period_s}')::numeric <= 0
    OR (p_payload #>> '{target_partition,direction_deg}')::numeric < 0
    OR (p_payload #>> '{target_partition,direction_deg}')::numeric >= 360 THEN
    RETURN QUERY SELECT false, 'invalid_payload', NULL::uuid; RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-event:' || v_event_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control', 0));
  SELECT control.state, control.epoch INTO v_state, v_epoch
  FROM public.swell_watch_get_automation_control() control;
  IF v_state IS DISTINCT FROM 'armed' OR v_epoch IS DISTINCT FROM p_expected_epoch THEN
    RETURN QUERY SELECT false, 'control_epoch_changed', NULL::uuid; RETURN;
  END IF;
  SELECT * INTO v_authority FROM public.swell_watch_production_approval_authority authority
  WHERE authority.state = 'active' AND authority.production_scope = 'swell_watch_push'
  ORDER BY authority.authority_epoch DESC LIMIT 1;
  IF v_authority.policy_hash IS DISTINCT FROM p_policy_hash
    OR v_authority.not_before > clock_timestamp() OR v_authority.expires_at <= clock_timestamp()
    OR public.swell_watch_production_policy_values_valid(v_authority.policy_values) IS DISTINCT FROM true
    OR v_authority.policy_values #> '{volume_caps,projected_send_window_hours}' IS DISTINCT FROM '24'::jsonb
    OR EXISTS (SELECT 1 FROM public.swell_watch_production_approval_authority revoked
      WHERE revoked.revokes_authority_id = v_authority.authority_id AND revoked.state IN ('revoked', 'superseded')) THEN
    RETURN QUERY SELECT false, 'authority_unavailable', NULL::uuid; RETURN;
  END IF;
  SELECT queued.id INTO v_notification_id FROM public.notification_events queued
  WHERE queued.type = 'swell_watch' AND queued.recipient_user_id = p_recipient_id
    AND queued.payload->>'schema_version' = 'swell-watch-notification.v2'
    AND (queued.payload->>'regional_event_id')::uuid = v_event_id;
  IF FOUND THEN
    RETURN QUERY SELECT false, 'duplicate', v_notification_id; RETURN;
  END IF;
  IF (SELECT transition.state FROM public.swell_watch_event_state_transitions transition
      WHERE transition.regional_event_id = v_event_id ORDER BY transition.version DESC LIMIT 1) IS DISTINCT FROM 'stable'
    OR (SELECT impact.policy_hash FROM public.swell_watch_event_impacts evaluation
      JOIN public.swell_watch_beach_impacts impact ON impact.id = evaluation.beach_impact_id
      WHERE evaluation.regional_event_id = v_event_id AND impact.beach_id = v_beach_id
      ORDER BY evaluation.evaluated_at DESC LIMIT 1) IS DISTINCT FROM p_policy_hash THEN
    RETURN QUERY SELECT false, 'event_not_releasable', NULL::uuid; RETURN;
  END IF;
  IF public.swell_watch_projected_send_count() + 1
    > (v_authority.policy_values #>> '{volume_caps,maximum_projected_sends_per_window}')::numeric THEN
    PERFORM * FROM public.transition_swell_watch_automation_control(
      'hold', v_epoch, 'projected_send_cap_exceeded', 'projected-send-cap:' || v_epoch::text,
      NULL, 'swell_watch_provider_monitor');
    RETURN QUERY SELECT false, 'projected_send_cap_exceeded', NULL::uuid; RETURN;
  END IF;
  IF (SELECT count(*) + 1 FROM (
      SELECT recipient_id FROM public.swell_watch_notification_event_bindings WHERE regional_event_id = v_event_id
      UNION
      SELECT recipient_id FROM public.swell_watch_recipient_announcements WHERE regional_event_id = v_event_id
    ) recipients) > (v_authority.policy_values #>> '{volume_caps,maximum_recipients_per_event}')::numeric THEN
    PERFORM * FROM public.transition_swell_watch_automation_control(
      'hold', v_epoch, 'recipient_cap_exceeded', 'recipient-cap:' || v_event_id::text || ':' || v_epoch::text,
      NULL, 'swell_watch_provider_monitor');
    RETURN QUERY SELECT false, 'recipient_cap_exceeded', NULL::uuid; RETURN;
  END IF;
  INSERT INTO public.notification_events(type, recipient_user_id, payload, dedupe_key)
  VALUES ('swell_watch', p_recipient_id, p_payload, 'swell_watch:' || v_event_id::text)
  RETURNING id INTO v_notification_id;
  PERFORM set_config('app.swell_watch_internal_write', 'on', true);
  INSERT INTO public.swell_watch_notification_event_bindings (
    notification_event_id, regional_event_id, beach_id, recipient_id, control_epoch,
    authority_id, authority_epoch, policy_hash, approval_evidence_hash, policy_provenance, policy_values
  ) VALUES (
    v_notification_id, v_event_id, v_beach_id, p_recipient_id, v_epoch,
    v_authority.authority_id, v_authority.authority_epoch, v_authority.policy_hash,
    v_authority.approval_evidence_hash, v_authority.policy_provenance, v_authority.policy_values
  );
  RETURN QUERY SELECT true, 'enqueued', v_notification_id;
END;
$$;
REVOKE ALL ON FUNCTION public.swell_watch_enqueue_notification(uuid, jsonb, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.swell_watch_enqueue_notification(uuid, jsonb, integer, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.swell_watch_get_automation_control() TO service_role;
GRANT EXECUTE ON FUNCTION public.swell_watch_get_production_authority() TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_swell_watch_automation_control(text, integer, text, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.swell_watch_validate_notification_release(uuid, uuid, uuid, timestamptz, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.swell_watch_record_provider_delivery_outcome(uuid, integer, integer, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.swell_watch_get_automation_control() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.swell_watch_get_production_authority() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.transition_swell_watch_automation_control(text, integer, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.swell_watch_validate_notification_release(uuid, uuid, uuid, timestamptz, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.swell_watch_record_provider_delivery_outcome(uuid, integer, integer, integer) FROM PUBLIC, anon, authenticated;

COMMIT;
