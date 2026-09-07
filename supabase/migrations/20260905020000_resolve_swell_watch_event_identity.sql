-- Local-only until separately reviewed for deployment. No historical identity merges.
BEGIN;

CREATE FUNCTION public.resolve_and_ingest_swell_watch_evaluation(
  p_provider_batch_id uuid,p_observation_id uuid,p_impact_id uuid,p_source_point_id uuid,
  p_region_key text,p_physical_key text,p_forecast_at timestamptz,p_source_slot text,
  p_height_m numeric,p_period_s numeric,p_direction_deg numeric,p_projected_face_height_ft numeric,
  p_policy_id text,p_policy_hash text,p_impact_hash text,p_arrival_at timestamptz,p_peak_at timestamptz
) RETURNS TABLE(regional_event_id uuid,event_state text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_authority record; v_reference record; v_event uuid; v_matches uuid[] := '{}';
  v_run timestamptz; v_evaluation text; v_component record; v_retry_ids uuid[];
  v_max_hours numeric; v_max_period numeric; v_max_direction numeric;
BEGIN
  IF p_region_key IS NULL OR char_length(btrim(p_region_key)) NOT BETWEEN 1 AND 100
    OR p_arrival_at IS NULL OR p_peak_at IS NULL OR NOT isfinite(p_arrival_at)
    OR NOT isfinite(p_peak_at) OR p_peak_at < p_arrival_at THEN
    RAISE EXCEPTION 'invalid identity selection input';
  END IF;
  -- ponytail: serialize the region and lock its history; partition history if volume warrants it.
  -- Order: region -> sorted existing events -> sorted provider runs -> control -> ingestion.
  -- Legacy ingestion also enters through the region lock; suppression takes only its event lock.
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-region:' || p_region_key,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-event:' || event.id::text,0))
    FROM public.swell_watch_regional_events event WHERE event.region_key=p_region_key ORDER BY event.id;
  SELECT issuance.run_utc,'genuine_completed:' || completed.batch_id INTO v_run,v_evaluation
    FROM public.swell_watch_provider_run_completed_batches completed
    JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
    JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
    WHERE completed.id=p_provider_batch_id;
  IF v_run IS NULL THEN RAISE EXCEPTION 'provider batch is not completed'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'swell-watch-provider-run:' || to_char(runs.run_utc AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"'),0))
  FROM (
    SELECT v_run AS run_utc UNION
    SELECT issuance.run_utc FROM public.swell_watch_event_impacts association
    JOIN public.swell_watch_regional_events event ON event.id=association.regional_event_id
    JOIN public.swell_watch_beach_impacts impact ON impact.id=association.beach_impact_id
    JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id
    JOIN public.swell_watch_provider_run_completed_batches completed ON completed.id=observation.provider_batch_id
    JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
    JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
    WHERE event.region_key=p_region_key
  ) runs ORDER BY runs.run_utc;
  SELECT * INTO v_component FROM public.read_swell_watch_attested_components(p_provider_batch_id,p_source_point_id,p_forecast_at)
    WHERE source_slot=p_source_slot;
  IF NOT FOUND OR v_component.height_m IS DISTINCT FROM p_height_m
    OR v_component.period_s IS DISTINCT FROM p_period_s OR v_component.direction_deg IS DISTINCT FROM p_direction_deg THEN
    RAISE EXCEPTION 'identity input does not match attested component';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT * INTO v_authority FROM public.swell_watch_get_production_authority();
  IF NOT FOUND OR v_authority.policy_hash IS DISTINCT FROM p_policy_hash
    OR v_authority.revoked_at IS NOT NULL OR v_authority.superseded_at IS NOT NULL
    OR clock_timestamp() < v_authority.not_before OR clock_timestamp() >= v_authority.expires_at
    OR jsonb_typeof(v_authority.policy_values #> '{partition_matching,maximum_arrival_delta_hours}') IS DISTINCT FROM 'number'
    OR jsonb_typeof(v_authority.policy_values #> '{partition_matching,maximum_period_delta_s}') IS DISTINCT FROM 'number'
    OR jsonb_typeof(v_authority.policy_values #> '{partition_matching,maximum_direction_delta_deg}') IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION 'current matching policy authority is required';
  END IF;
  v_max_hours := (v_authority.policy_values #>> '{partition_matching,maximum_arrival_delta_hours}')::numeric;
  v_max_period := (v_authority.policy_values #>> '{partition_matching,maximum_period_delta_s}')::numeric;
  v_max_direction := (v_authority.policy_values #>> '{partition_matching,maximum_direction_delta_deg}')::numeric;
  IF v_max_hours<=0 OR v_max_period<=0 OR v_max_direction<=0 OR v_max_direction>180 THEN
    RAISE EXCEPTION 'invalid matching policy thresholds';
  END IF;
  SELECT array_agg(DISTINCT association.regional_event_id) INTO v_retry_ids
  FROM public.swell_watch_event_impacts association
  JOIN public.swell_watch_regional_events event ON event.id=association.regional_event_id
  JOIN public.swell_watch_beach_impacts impact ON impact.id=association.beach_impact_id
  JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id
  WHERE event.region_key=p_region_key AND observation.provider_batch_id=p_provider_batch_id
    AND observation.source_point_id=p_source_point_id AND observation.forecast_at=p_forecast_at
    AND observation.source_slot=p_source_slot;
  IF cardinality(v_retry_ids)>1 THEN RAISE EXCEPTION 'ambiguous regional identity'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.swell_watch_event_impacts association
    WHERE association.regional_event_id=ANY(v_retry_ids) AND association.evaluation_id=v_evaluation
      AND association.beach_id=p_source_point_id AND association.evaluated_at <= (
        SELECT max(t.created_at) FROM public.swell_watch_event_state_transitions t
        WHERE t.regional_event_id=association.regional_event_id AND t.state='suppressed')
  ) THEN RAISE EXCEPTION 'compatible regional identity requires current-cycle evidence'; END IF;
  v_matches := coalesce(v_retry_ids,'{}');
  FOR v_reference IN
    SELECT reference.*,observation.provider,observation.period_s,observation.direction_deg,
      observation.provider_batch_id,impact.policy_hash,issuance.run_utc,
      (SELECT max(t.created_at) FROM public.swell_watch_event_state_transitions t
        WHERE t.regional_event_id=reference.regional_event_id AND t.state='suppressed') AS suppressed_at
    FROM public.swell_watch_regional_events event
    CROSS JOIN LATERAL (
      SELECT DISTINCT ON (association.beach_id) association.*
      FROM public.swell_watch_event_impacts association WHERE association.regional_event_id=event.id
      ORDER BY association.beach_id,association.evaluated_at DESC,association.id DESC
    ) reference
    JOIN public.swell_watch_beach_impacts impact ON impact.id=reference.beach_impact_id
    JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id
    LEFT JOIN public.swell_watch_provider_run_completed_batches completed ON completed.id=observation.provider_batch_id
    LEFT JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
    LEFT JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
    WHERE event.region_key=p_region_key
  LOOP
    IF v_reference.provider='open_meteo' AND abs(v_reference.period_s-p_period_s)<=v_max_period
      AND least(abs(v_reference.direction_deg-p_direction_deg),360-abs(v_reference.direction_deg-p_direction_deg))<=v_max_direction
      AND abs(extract(epoch FROM v_reference.arrival_at-p_arrival_at))<=v_max_hours*3600
      AND abs(extract(epoch FROM v_reference.peak_at-p_peak_at))<=v_max_hours*3600 THEN
      -- Never bypass stale/suppressed evidence or permanent dedupe by allocating a fresh ID.
      IF public.swell_watch_provider_evidence_is_current(v_reference.provider_batch_id) IS DISTINCT FROM true
        OR v_reference.policy_hash IS DISTINCT FROM p_policy_hash
        OR (v_reference.run_utc > v_run AND NOT v_reference.regional_event_id=ANY(coalesce(v_retry_ids,'{}')))
        OR v_reference.evaluated_at <= v_reference.suppressed_at THEN
        RAISE EXCEPTION 'compatible regional identity requires current-cycle evidence';
      END IF;
      IF NOT v_reference.regional_event_id=ANY(v_matches) THEN
        v_matches := array_append(v_matches,v_reference.regional_event_id);
      END IF;
    END IF;
  END LOOP;
  IF cardinality(v_matches)>1 THEN RAISE EXCEPTION 'ambiguous regional identity'; END IF;
  v_event := coalesce(v_matches[1],gen_random_uuid());
  PERFORM public.ingest_verified_swell_watch_evaluation(p_provider_batch_id,p_observation_id,p_impact_id,v_event,
    p_source_point_id,p_region_key,p_physical_key,p_forecast_at,p_source_slot,p_height_m,p_period_s,p_direction_deg,
    p_projected_face_height_ft,p_policy_id,p_policy_hash,p_impact_hash,p_arrival_at,p_peak_at);
  -- Legacy retry reconciliation must not silently choose an identity outside this transaction's match.
  IF NOT EXISTS (
    SELECT 1 FROM public.swell_watch_event_impacts association
    JOIN public.swell_watch_beach_impacts impact ON impact.id=association.beach_impact_id
    JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id
    WHERE association.regional_event_id=v_event AND association.evaluation_id=v_evaluation
      AND association.beach_id=p_source_point_id AND impact.impact_hash=p_impact_hash
      AND observation.provider_batch_id=p_provider_batch_id AND observation.forecast_at=p_forecast_at
      AND observation.source_slot=p_source_slot
  ) THEN RAISE EXCEPTION 'resolved identity was not ingested'; END IF;
  RETURN QUERY SELECT v_event,coalesce((SELECT transition.state FROM public.swell_watch_event_state_transitions transition
    WHERE transition.regional_event_id=v_event ORDER BY transition.version DESC LIMIT 1),'candidate');
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_and_ingest_swell_watch_evaluation(uuid,uuid,uuid,uuid,text,text,timestamptz,text,numeric,numeric,numeric,numeric,text,text,text,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_and_ingest_swell_watch_evaluation(uuid,uuid,uuid,uuid,text,text,timestamptz,text,numeric,numeric,numeric,numeric,text,text,text,timestamptz,timestamptz) TO service_role;
COMMIT;
