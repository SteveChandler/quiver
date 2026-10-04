-- Epoch 7 detector support: read-only trailing model frames for the baseline. Additive; no existing function is redefined
-- and nothing reads it until a policy with detection.baseline is the active study policy.
-- Rollback: DROP FUNCTION public.read_swell_watch_trailing_baseline(uuid,uuid,integer,integer); callers then fail closed.
-- read_swell_watch_trailing_baseline(uuid,uuid,integer,integer): new; post 71926421638a5e0bed67c833dc950d462637ae8d675454b4e94191dc01789a10.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE FUNCTION public.read_swell_watch_trailing_baseline(
  p_provider_batch_id uuid,p_source_point_id uuid,p_trailing_hours integer,p_maximum_lead_hours integer
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
SET lock_timeout='10s' SET statement_timeout='60s' AS $$
DECLARE v_run timestamptz; v_transport text; v_model text;
BEGIN
  IF p_provider_batch_id IS NULL OR p_source_point_id IS NULL
    OR p_trailing_hours IS NULL OR p_trailing_hours NOT BETWEEN 6 AND 72
    OR p_maximum_lead_hours IS NULL OR p_maximum_lead_hours NOT BETWEEN 1 AND 24 THEN
    RAISE EXCEPTION 'trailing baseline scope is required';
  END IF;
  SELECT issuance.run_utc,issuance.transport_provider,issuance.model INTO v_run,v_transport,v_model
  FROM public.swell_watch_provider_run_completed_batches completed
  JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
  JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
  WHERE completed.id=p_provider_batch_id;
  IF v_run IS NULL THEN RAISE EXCEPTION 'completed provider run is required'; END IF;
  IF public.swell_watch_provider_evidence_is_current(p_provider_batch_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'current provider attestation is required';
  END IF;
  -- Prior issuances are judged by provider attestation alone: a study epoch change must not erase the trailing history.
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('forecastAt',frame.forecast_at,'runUtc',frame.run_utc,'components',frame.components) ORDER BY frame.forecast_at)
    FROM (
      SELECT chosen.forecast_at,chosen.run_utc,
        jsonb_agg(jsonb_build_object('sourceSlot',chosen.source_slot,'heightM',chosen.height_m,'periodS',chosen.period_s,'directionDeg',chosen.direction_deg)
          || CASE WHEN chosen.unavailable_reason IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('unavailableReason',chosen.unavailable_reason) END
          ORDER BY chosen.source_slot) AS components
      FROM (
        SELECT DISTINCT ON (component.forecast_at,component.source_slot)
          component.forecast_at,component.source_slot,component.height_m,component.period_s,component.direction_deg,
          component.unavailable_reason,issuance.run_utc
        FROM public.swell_watch_provider_run_issuances issuance
        JOIN public.swell_watch_provider_run_batches batch ON batch.issuance_id=issuance.id
        JOIN public.swell_watch_provider_run_batch_scopes scope ON scope.batch_id=batch.id AND scope.source_point_id=p_source_point_id
        JOIN public.swell_watch_provider_run_revision_sets revision_set ON revision_set.batch_id=batch.id
        JOIN public.swell_watch_provider_run_completed_batches completed ON completed.revision_set_id=revision_set.id
        JOIN public.swell_watch_provider_run_revision_set_members member ON member.revision_set_id=revision_set.id AND member.scope_id=scope.id
        JOIN public.swell_watch_provider_run_revision_components component ON component.revision_id=member.revision_id
        WHERE issuance.transport_provider=v_transport AND issuance.model=v_model
          AND issuance.run_utc<v_run
          AND component.forecast_at>=issuance.run_utc
          AND component.forecast_at<issuance.run_utc+make_interval(hours=>p_maximum_lead_hours)
          AND component.forecast_at>=v_run-make_interval(hours=>p_trailing_hours)
          AND component.forecast_at<v_run
          AND public.swell_watch_provider_evidence_is_current_before_study(completed.id)
          AND NOT EXISTS(SELECT 1 FROM public.swell_watch_provider_run_attestations attestation
            WHERE attestation.revision_set_id=revision_set.id AND attestation.state IN ('rejected','revoked'))
        ORDER BY component.forecast_at,component.source_slot,issuance.run_utc DESC,revision_set.revision_number DESC
      ) chosen
      GROUP BY chosen.forecast_at,chosen.run_utc
    ) frame
  ),'[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.read_swell_watch_trailing_baseline(uuid,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_swell_watch_trailing_baseline(uuid,uuid,integer,integer) TO service_role;

DO $pin$
BEGIN
  IF encode(extensions.digest(pg_get_functiondef('public.read_swell_watch_trailing_baseline(uuid,uuid,integer,integer)'::regprocedure),'sha256'),'hex')<>'71926421638a5e0bed67c833dc950d462637ae8d675454b4e94191dc01789a10' THEN
    RAISE EXCEPTION 'trailing baseline definition hash mismatch';
  END IF;
END;
$pin$;
COMMIT;
