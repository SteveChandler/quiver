-- Require evidence from the beach's latest completed runs, including missing-data runs.
-- ponytail: global nonblocking completion/release lock; use ordered beach locks if contention warrants it.
-- Order: release event -> completion frontier -> provider runs -> control; completion frontier -> provider run.
BEGIN;

CREATE OR REPLACE FUNCTION public.complete_swell_watch_provider_run_receipt(p_revision_set_id uuid)
RETURNS TABLE(provider_batch_id uuid, evaluation_id text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_batch uuid; v_run_text text; v_completed public.swell_watch_provider_run_completed_batches;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('swell-watch-completed-provider-frontier',0)) THEN
    RAISE EXCEPTION 'provider completion is busy; retry transaction';
  END IF;
  SELECT revision_set.batch_id,to_char(issuance.run_utc AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"') INTO v_batch,v_run_text
  FROM public.swell_watch_provider_run_revision_sets revision_set
  JOIN public.swell_watch_provider_run_batches batch ON batch.id=revision_set.batch_id
  JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
  WHERE revision_set.id=p_revision_set_id;
  IF v_batch IS NULL THEN RAISE EXCEPTION 'provider revision set does not exist'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-provider-run:' || v_run_text,0));
  IF NOT EXISTS (
    SELECT 1
    FROM public.swell_watch_provider_run_revision_sets requested
    WHERE requested.id = p_revision_set_id
      AND requested.revision_number = (
        SELECT max(candidate.revision_number)
        FROM public.swell_watch_provider_run_revision_sets candidate
        WHERE candidate.batch_id = v_batch
      )
  ) THEN RAISE EXCEPTION 'only the latest provider revision set can be completed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.swell_watch_provider_run_attestations accepted WHERE accepted.revision_set_id=p_revision_set_id AND accepted.state='accepted' AND NOT EXISTS (SELECT 1 FROM public.swell_watch_provider_run_attestations revoked WHERE revoked.state='revoked' AND revoked.revokes_attestation_id=accepted.id)) THEN RAISE EXCEPTION 'active accepted attestation is required'; END IF;
  SELECT * INTO v_completed FROM public.swell_watch_provider_run_completed_batches WHERE revision_set_id=p_revision_set_id;
  IF v_completed.id IS NOT NULL THEN RETURN QUERY SELECT v_completed.id,'genuine_completed:' || v_batch; RETURN; END IF;
  PERFORM set_config('app.swell_watch_internal_write','on',true);
  INSERT INTO public.swell_watch_provider_run_completed_batches (batch_id,revision_set_id) VALUES (v_batch,p_revision_set_id) RETURNING id INTO provider_batch_id;
  RETURN QUERY SELECT provider_batch_id,'genuine_completed:' || v_batch;
END;
$$;


CREATE OR REPLACE FUNCTION public.swell_watch_validate_notification_release(p_regional_event_id uuid,p_beach_id uuid,p_recipient_id uuid,p_forecast_at timestamptz,p_notification_event_id uuid)
RETURNS TABLE(allowed boolean,reason_code text,control_epoch integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_identity_kind text;
  v_provider_batch_id uuid;
  v_supporting_evidence_count integer;
  v_current_supporting_evidence_count integer;
  v_supporting_issuance_count integer;
  v_policy_values jsonb;
  v_policy_hash text;
  v_required numeric;
  v_max_direction numeric;
  v_max_period numeric;
  v_max_hours numeric;
  v_continuous boolean;
  v_latest_issuances uuid[];
  v_fresh boolean;
BEGIN
  IF p_regional_event_id IS NULL OR p_beach_id IS NULL OR p_recipient_id IS NULL
    OR p_forecast_at IS NULL OR NOT isfinite(p_forecast_at) OR p_notification_event_id IS NULL THEN
    RETURN QUERY SELECT false,'invalid_release_input',NULL::integer;
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-event:' || p_regional_event_id::text,0));
  IF NOT pg_try_advisory_xact_lock_shared(hashtextextended('swell-watch-completed-provider-frontier',0)) THEN
    RETURN QUERY SELECT false,'provider_evidence_unavailable',NULL::integer;
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'swell-watch-provider-run:' || to_char(provider_runs.run_utc AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"'),0
  ))
  FROM (
    SELECT DISTINCT issuance.run_utc
    FROM public.swell_watch_event_impacts evaluation
    JOIN public.swell_watch_beach_impacts impact ON impact.id=evaluation.beach_impact_id
    JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id
    JOIN public.swell_watch_provider_run_completed_batches completed ON completed.id=observation.provider_batch_id
    JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
    JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
    WHERE evaluation.regional_event_id=p_regional_event_id AND impact.beach_id=p_beach_id
      AND observation.identity_kind='genuine_completed'
  ) provider_runs
  ORDER BY provider_runs.run_utc;
  SELECT observation.identity_kind,observation.provider_batch_id INTO v_identity_kind,v_provider_batch_id
  FROM public.swell_watch_event_state_transitions transition
  JOIN public.swell_watch_event_impacts evaluation ON evaluation.regional_event_id=transition.regional_event_id
  JOIN public.swell_watch_beach_impacts impact ON impact.id=evaluation.beach_impact_id
  JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id
  WHERE transition.regional_event_id=p_regional_event_id AND impact.beach_id=p_beach_id
  ORDER BY transition.version DESC,evaluation.evaluated_at DESC,evaluation.id DESC LIMIT 1;
  SELECT count(*),
    count(*) FILTER (WHERE identity_kind='genuine_completed'
      AND public.swell_watch_provider_evidence_is_current(provider_batch_id) IS TRUE),
    count(DISTINCT issuance_id)
  INTO v_supporting_evidence_count,v_current_supporting_evidence_count,v_supporting_issuance_count
  FROM (
    SELECT observation.identity_kind,observation.provider_batch_id,issuance.id AS issuance_id
    FROM public.swell_watch_event_impacts evaluation
    JOIN public.swell_watch_beach_impacts impact ON impact.id=evaluation.beach_impact_id
    JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id
    LEFT JOIN public.swell_watch_provider_run_completed_batches completed ON completed.id=observation.provider_batch_id
    LEFT JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
    LEFT JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
    WHERE evaluation.regional_event_id=p_regional_event_id AND impact.beach_id=p_beach_id
      AND evaluation.evaluated_at>coalesce((SELECT max(transition.created_at) FROM public.swell_watch_event_state_transitions transition WHERE transition.regional_event_id=p_regional_event_id AND transition.state='suppressed'),'-infinity'::timestamptz)
    ORDER BY evaluation.evaluated_at DESC,evaluation.id DESC LIMIT 2
  ) supporting_evidence;
  IF v_identity_kind IS DISTINCT FROM 'genuine_completed'
    OR public.swell_watch_provider_evidence_is_current(v_provider_batch_id) IS DISTINCT FROM true
    OR v_supporting_evidence_count IS DISTINCT FROM 2
    OR v_current_supporting_evidence_count IS DISTINCT FROM 2
    OR v_supporting_issuance_count IS DISTINCT FROM 2 THEN
    RETURN QUERY SELECT false,'provider_evidence_unavailable',NULL::integer;
    RETURN;
  END IF;
  -- A stable row and two authentic runs do not prove they describe one swell.
  -- Use owner-approved thresholds, never caller-supplied matching tolerances.
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT authority.policy_values,authority.policy_hash INTO v_policy_values,v_policy_hash
  FROM public.swell_watch_production_approval_authority authority
  WHERE authority.state='active' AND authority.production_scope='swell_watch_push'
  ORDER BY authority.authority_epoch DESC LIMIT 1;
  IF jsonb_typeof(v_policy_values #> '{partition_matching,maximum_direction_delta_deg}') IS DISTINCT FROM 'number'
    OR jsonb_typeof(v_policy_values #> '{partition_matching,maximum_period_delta_s}') IS DISTINCT FROM 'number'
    OR jsonb_typeof(v_policy_values #> '{partition_matching,maximum_arrival_delta_hours}') IS DISTINCT FROM 'number'
    OR jsonb_typeof(v_policy_values #> '{stability,minimum_genuine_evaluations}') IS DISTINCT FROM 'number' THEN
    RETURN QUERY SELECT false,'authority_unavailable',NULL::integer;
    RETURN;
  END IF;
  v_max_direction := (v_policy_values #>> '{partition_matching,maximum_direction_delta_deg}')::numeric;
  v_max_period := (v_policy_values #>> '{partition_matching,maximum_period_delta_s}')::numeric;
  v_max_hours := (v_policy_values #>> '{partition_matching,maximum_arrival_delta_hours}')::numeric;
  v_required := (v_policy_values #>> '{stability,minimum_genuine_evaluations}')::numeric;
  IF v_max_direction<=0 OR v_max_period<=0 OR v_max_hours<=0
    OR v_required<2 OR v_required>2147483647 OR trunc(v_required)<>v_required THEN
    RETURN QUERY SELECT false,'authority_unavailable',NULL::integer;
    RETURN;
  END IF;
  SELECT array_agg(latest.id ORDER BY latest.run_utc DESC) INTO v_latest_issuances
  FROM (
    SELECT DISTINCT issuance.id,issuance.run_utc
    FROM public.swell_watch_provider_run_completed_batches completed
    JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
    JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
    JOIN public.swell_watch_provider_run_batch_scopes scope ON scope.batch_id=batch.id
    WHERE scope.source_point_id=p_beach_id
    ORDER BY issuance.run_utc DESC LIMIT v_required::integer
  ) latest;
  WITH supporting AS (
    SELECT evaluation.id,evaluation.evaluated_at,evaluation.arrival_at,evaluation.peak_at,
      observation.provider,observation.period_s,observation.direction_deg,
      observation.provider_batch_id,impact.policy_hash,issuance.id AS issuance_id,issuance.run_utc
    FROM public.swell_watch_event_impacts evaluation
    JOIN public.swell_watch_beach_impacts impact ON impact.id=evaluation.beach_impact_id
    JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id
    LEFT JOIN public.swell_watch_provider_run_completed_batches completed ON completed.id=observation.provider_batch_id
    LEFT JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
    LEFT JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
    WHERE evaluation.regional_event_id=p_regional_event_id AND impact.beach_id=p_beach_id
      AND evaluation.evaluated_at>coalesce((SELECT max(transition.created_at) FROM public.swell_watch_event_state_transitions transition WHERE transition.regional_event_id=p_regional_event_id AND transition.state='suppressed'),'-infinity'::timestamptz)
    ORDER BY evaluation.evaluated_at DESC,evaluation.id DESC LIMIT v_required::integer
  ), pairs AS (
    SELECT *,lead(provider) OVER sequence AS prior_provider,
      lead(period_s) OVER sequence AS prior_period,lead(direction_deg) OVER sequence AS prior_direction,
      lead(arrival_at) OVER sequence AS prior_arrival,lead(peak_at) OVER sequence AS prior_peak,
      lead(run_utc) OVER sequence AS prior_run
    FROM supporting WINDOW sequence AS (ORDER BY evaluated_at DESC,id DESC)
  )
  SELECT cardinality(v_latest_issuances)=v_required AND bool_and(issuance_id=ANY(v_latest_issuances)),
    count(*)=v_required AND count(DISTINCT issuance_id)=v_required
    AND bool_and(public.swell_watch_provider_evidence_is_current(provider_batch_id) IS TRUE
      AND policy_hash=v_policy_hash AND isfinite(arrival_at) AND isfinite(peak_at)
      AND (prior_provider IS NULL OR (
        provider=prior_provider AND run_utc>prior_run
        AND abs(period_s-prior_period)<=v_max_period
        AND least(abs(direction_deg-prior_direction),360-abs(direction_deg-prior_direction))<=v_max_direction
        AND abs(extract(epoch FROM arrival_at-prior_arrival))<=v_max_hours*3600
        AND abs(extract(epoch FROM peak_at-prior_peak))<=v_max_hours*3600)))
  INTO v_fresh,v_continuous FROM pairs;
  IF v_continuous IS DISTINCT FROM true THEN
    RETURN QUERY SELECT false,'event_not_releasable',NULL::integer;
    RETURN;
  END IF;
  IF v_fresh IS DISTINCT FROM true THEN
    RETURN QUERY SELECT false,'provider_evidence_unavailable',NULL::integer;
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.swell_watch_validate_notification_release_internal(p_regional_event_id,p_beach_id,p_recipient_id,p_forecast_at,p_notification_event_id);
END; $$;

COMMIT;
