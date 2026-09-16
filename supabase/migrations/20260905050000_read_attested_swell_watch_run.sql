-- Read one frozen source horizon atomically; never accept caller-supplied run metadata.
-- Rollback: revoke/drop this read-only RPC; retained evidence is unchanged.
BEGIN;

CREATE FUNCTION public.read_swell_watch_attested_run(p_provider_batch_id uuid,p_source_point_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_run timestamptz; v_result jsonb; v_days integer;
BEGIN
  IF p_provider_batch_id IS NULL OR p_source_point_id IS NULL THEN
    RAISE EXCEPTION 'provider run scope is required';
  END IF;
  SELECT issuance.run_utc INTO v_run
  FROM public.swell_watch_provider_run_completed_batches completed
  JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
  JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
  WHERE completed.id=p_provider_batch_id;
  IF v_run IS NULL THEN RAISE EXCEPTION 'completed provider run is required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-provider-run:' || to_char(v_run AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"'),0));
  IF public.swell_watch_provider_evidence_is_current(p_provider_batch_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'current provider attestation is required';
  END IF;
  SELECT scope.forecast_days,jsonb_build_object(
    'source',jsonb_build_object('provider','open_meteo','transportProvider',issuance.transport_provider,
      'model',issuance.model,'upstreamModelProvider',issuance.upstream_model_provider,
      'sourcePointId',scope.source_point_id,'issuedAt',issuance.run_utc,
      'issuanceId',issuance.id,'evaluationId','genuine_completed:' || completed.batch_id,
      'providerBatchId',completed.id,'revisionSetId',completed.revision_set_id),
    'forecastDays',scope.forecast_days,'selectedGrid',revision.selected_grid,
    'samples',(SELECT jsonb_agg(jsonb_build_object('forecastAt',frame.forecast_at,'components',frame.components) ORDER BY frame.forecast_at)
      FROM (SELECT component.forecast_at,jsonb_agg(jsonb_build_object(
        'sourceSlot',component.source_slot,'heightM',component.height_m,'periodS',component.period_s,
        'directionDeg',component.direction_deg,
        'rawFieldProvenance',component.raw_field_provenance,'timeProvenance',component.time_provenance)
        || CASE WHEN component.unavailable_reason IS NULL THEN '{}'::jsonb
          ELSE jsonb_build_object('unavailableReason',component.unavailable_reason) END
        ORDER BY component.source_slot) AS components
        FROM public.swell_watch_provider_run_revision_components component
        WHERE component.revision_id=revision.id GROUP BY component.forecast_at) frame))
  INTO v_days,v_result
  FROM public.swell_watch_provider_run_completed_batches completed
  JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
  JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
  JOIN public.swell_watch_provider_run_revision_set_members member ON member.revision_set_id=completed.revision_set_id
  JOIN public.swell_watch_provider_run_batch_scopes scope ON scope.id=member.scope_id AND scope.batch_id=batch.id
  JOIN public.swell_watch_provider_run_revisions revision ON revision.id=member.revision_id AND revision.scope_id=scope.id
  WHERE completed.id=p_provider_batch_id AND scope.source_point_id=p_source_point_id;
  IF v_result IS NULL OR jsonb_array_length(v_result->'samples') IS DISTINCT FROM v_days*24 THEN
    RAISE EXCEPTION 'provider run horizon is unavailable';
  END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.read_swell_watch_attested_run(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_swell_watch_attested_run(uuid,uuid) TO service_role;

COMMIT;
