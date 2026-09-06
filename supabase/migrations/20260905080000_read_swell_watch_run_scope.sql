-- Frozen acquisition scope for coordinator coverage checks. No evidence qualification or writes.
-- Rollback: revoke/drop this reader and keep the runtime producer disabled.
BEGIN;
CREATE FUNCTION public.read_swell_watch_run_scope(p_provider_batch_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE run_time timestamptz; result jsonb;
BEGIN
  SELECT issuance.run_utc INTO run_time
  FROM public.swell_watch_provider_run_completed_batches completed
  JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
  JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
  WHERE completed.id=p_provider_batch_id;
  IF run_time IS NULL THEN RAISE EXCEPTION 'completed provider run is required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-provider-run:' ||
    to_char(run_time AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"'),0));
  IF public.swell_watch_provider_evidence_is_current(p_provider_batch_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'current provider attestation is required';
  END IF;
  SELECT jsonb_build_object('providerBatchId',completed.id,
    'evaluationId','genuine_completed:' || completed.batch_id,'issuedAt',run_time,
    'scopeHash',batch.scope_hash,'expectedComponentCount',batch.expected_component_count,
    'scopes',(SELECT jsonb_agg(jsonb_build_object('sourcePointId',scope.source_point_id,
      'latitude',scope.requested_lat,'longitude',scope.requested_lon,'forecastDays',scope.forecast_days)
      ORDER BY scope.source_point_id) FROM public.swell_watch_provider_run_batch_scopes scope
      WHERE scope.batch_id=batch.id))
  INTO result FROM public.swell_watch_provider_run_completed_batches completed
  JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
  WHERE completed.id=p_provider_batch_id;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.read_swell_watch_run_scope(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_swell_watch_run_scope(uuid) TO service_role;
COMMIT;
