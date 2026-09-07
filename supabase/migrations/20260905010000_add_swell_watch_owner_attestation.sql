-- Owner-reviewed evidence only. Runtime service roles cannot attest their own receipts.
BEGIN;

CREATE FUNCTION public.attest_swell_watch_provider_run(
  p_attestation_id uuid, p_revision_set_id uuid, p_state text,
  p_reviewer text, p_evidence_sha256 text, p_provider_contract_ref text,
  p_revokes_attestation_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_existing public.swell_watch_provider_run_attestations; v_run text; v_batch uuid;
BEGIN
  IF p_attestation_id IS NULL OR p_revision_set_id IS NULL OR p_state IS NULL
    OR p_state NOT IN ('accepted','rejected','revoked')
    OR p_reviewer IS NULL OR char_length(btrim(p_reviewer)) NOT BETWEEN 1 AND 200
    OR p_evidence_sha256 IS NULL OR p_evidence_sha256 !~ '^[a-f0-9]{64}$'
    OR p_provider_contract_ref IS NULL OR char_length(btrim(p_provider_contract_ref)) NOT BETWEEN 1 AND 500
    OR (p_state='revoked') IS DISTINCT FROM (p_revokes_attestation_id IS NOT NULL)
  THEN RAISE EXCEPTION 'invalid provider attestation'; END IF;

  SELECT batch.id, to_char(issuance.run_utc AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"')
    INTO v_batch,v_run
  FROM public.swell_watch_provider_run_revision_sets revision_set
  JOIN public.swell_watch_provider_run_batches batch ON batch.id=revision_set.batch_id
  JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
  WHERE revision_set.id=p_revision_set_id;
  IF v_batch IS NULL THEN RAISE EXCEPTION 'provider revision set does not exist'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-provider-run:' || v_run,0));
  SELECT * INTO v_existing FROM public.swell_watch_provider_run_attestations WHERE id=p_attestation_id;
  IF FOUND THEN
    IF v_existing.revision_set_id IS DISTINCT FROM p_revision_set_id OR v_existing.state IS DISTINCT FROM p_state
      OR v_existing.reviewer IS DISTINCT FROM p_reviewer OR v_existing.evidence_sha256 IS DISTINCT FROM p_evidence_sha256
      OR v_existing.provider_contract_ref IS DISTINCT FROM p_provider_contract_ref
      OR v_existing.revokes_attestation_id IS DISTINCT FROM p_revokes_attestation_id
    THEN RAISE EXCEPTION 'provider attestation identity conflict'; END IF;
    RETURN v_existing.id;
  END IF;
  IF p_state='accepted' AND NOT EXISTS (
    SELECT 1 FROM public.swell_watch_provider_run_revision_sets revision_set
    WHERE revision_set.id=p_revision_set_id AND revision_set.revision_number=(
      SELECT max(candidate.revision_number) FROM public.swell_watch_provider_run_revision_sets candidate WHERE candidate.batch_id=v_batch
    )
  ) THEN RAISE EXCEPTION 'cannot accept a superseded provider revision'; END IF;
  PERFORM set_config('app.swell_watch_internal_write','on',true);
  INSERT INTO public.swell_watch_provider_run_attestations
    (id,revision_set_id,state,reviewer,evidence_sha256,provider_contract_ref,revokes_attestation_id)
  VALUES (p_attestation_id,p_revision_set_id,p_state,p_reviewer,p_evidence_sha256,p_provider_contract_ref,p_revokes_attestation_id);
  RETURN p_attestation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.attest_swell_watch_provider_run(uuid,uuid,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION public.attest_swell_watch_provider_run(uuid,uuid,text,text,text,text,uuid) IS 'Owner-only reviewed evidence decision; never automatic provider qualification or release approval.';

CREATE FUNCTION public.read_swell_watch_attested_components(p_provider_batch_id uuid,p_source_point_id uuid,p_forecast_at timestamptz)
RETURNS TABLE(evaluation_id text,source_slot text,height_m numeric,period_s numeric,direction_deg numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.swell_watch_provider_evidence_is_current(p_provider_batch_id) THEN
    RAISE EXCEPTION 'current provider attestation is required';
  END IF;
  RETURN QUERY SELECT 'genuine_completed:' || completed.batch_id,component.source_slot,
    component.height_m,component.period_s,component.direction_deg
  FROM public.swell_watch_provider_run_completed_batches completed
  JOIN public.swell_watch_provider_run_revision_set_members member ON member.revision_set_id=completed.revision_set_id
  JOIN public.swell_watch_provider_run_batch_scopes scope ON scope.id=member.scope_id
  JOIN public.swell_watch_provider_run_revision_components component ON component.revision_id=member.revision_id
  WHERE completed.id=p_provider_batch_id AND scope.source_point_id=p_source_point_id AND component.forecast_at=p_forecast_at
  ORDER BY component.source_slot;
END;
$$;
REVOKE ALL ON FUNCTION public.read_swell_watch_attested_components(uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_swell_watch_attested_components(uuid,uuid,timestamptz) TO service_role;
COMMIT;
