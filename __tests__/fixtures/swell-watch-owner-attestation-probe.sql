-- Disposable fixtures only; these decisions are not real provider evidence.
DO $$
DECLARE v_set uuid; v_id uuid := gen_random_uuid(); v_result uuid; v_role text; v_completed uuid; v_component record; v_observation uuid := gen_random_uuid();
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_function_privilege(v_role,'public.attest_swell_watch_provider_run(uuid,uuid,text,text,text,text,uuid)','EXECUTE') THEN
      RAISE EXCEPTION 'runtime role can attest its own provider evidence';
    END IF;
  END LOOP;
  SELECT revision_set_id INTO v_set FROM public.record_swell_watch_provider_run_receipt(public.fixture_provider_run_scopes('2026-09-05T00:00Z',1.4,1,p_primary_period=>9,p_secondary_height=>1.8,p_secondary_period=>13,p_secondary_direction=>170));
  BEGIN
    PERFORM public.complete_swell_watch_provider_run_receipt(v_set);
    RAISE EXCEPTION 'unattested completion unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'active accepted attestation is required' THEN RAISE; END IF;
  END;
  v_result := public.attest_swell_watch_provider_run(v_id,v_set,'accepted','fixture-reviewer',repeat('a',64),'fixture-contract');
  IF v_result <> v_id OR public.attest_swell_watch_provider_run(v_id,v_set,'accepted','fixture-reviewer',repeat('a',64),'fixture-contract') <> v_id THEN RAISE EXCEPTION 'attestation retry mismatch'; END IF;
  IF (SELECT count(*) FROM public.swell_watch_provider_run_attestations WHERE id=v_id) <> 1 THEN RAISE EXCEPTION 'duplicate attestation'; END IF;
  BEGIN
    PERFORM public.attest_swell_watch_provider_run(v_id,v_set,'accepted','fixture-reviewer',repeat('b',64),'fixture-contract');
    RAISE EXCEPTION 'attestation conflict unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'provider attestation identity conflict' THEN RAISE; END IF;
  END;
  SELECT provider_batch_id INTO v_completed FROM public.complete_swell_watch_provider_run_receipt(v_set);
  IF (SELECT count(*) FROM public.read_swell_watch_attested_components(v_completed,'11111111-1111-4111-8111-111111111111','2026-09-05T00:00Z')) <> 2 THEN RAISE EXCEPTION 'attested component read incomplete'; END IF;
  SELECT * INTO v_component FROM public.read_swell_watch_attested_components(v_completed,'11111111-1111-4111-8111-111111111111','2026-09-05T00:00Z') WHERE source_slot='s2';
  IF v_component.height_m<>1.8 OR v_component.period_s<>13 OR v_component.direction_deg<>170 THEN RAISE EXCEPTION 'attested S2 changed'; END IF;
  PERFORM public.ingest_verified_swell_watch_evaluation(v_completed,v_observation,gen_random_uuid(),gen_random_uuid(),'11111111-1111-4111-8111-111111111111','attested-read-region','attested-read-event','2026-09-05T00:00Z',v_component.source_slot,v_component.height_m,v_component.period_s,v_component.direction_deg,2,'fixture-policy',repeat('a',64),repeat('b',64),'2026-09-08T00:00Z','2026-09-09T00:00Z');
  IF NOT EXISTS (SELECT 1 FROM public.swell_watch_observations WHERE id=v_observation AND provider_batch_id=v_completed AND source_slot='s2' AND height_m=v_component.height_m AND period_s=v_component.period_s AND direction_deg=v_component.direction_deg) THEN RAISE EXCEPTION 'attested read to ingestion lost provenance'; END IF;
  PERFORM public.attest_swell_watch_provider_run(gen_random_uuid(),v_set,'revoked','fixture-reviewer',repeat('b',64),'fixture-contract',v_id);
  BEGIN
    PERFORM public.read_swell_watch_attested_components(v_completed,'11111111-1111-4111-8111-111111111111','2026-09-05T00:00Z');
    RAISE EXCEPTION 'revoked component read unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'current provider attestation is required' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.complete_swell_watch_provider_run_receipt(v_set);
    RAISE EXCEPTION 'revoked completion unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'active accepted attestation is required' THEN RAISE; END IF;
  END;
  PERFORM public.record_swell_watch_provider_run_receipt(public.fixture_provider_run_scopes('2026-09-05T00:00Z',1.5,1));
  BEGIN
    PERFORM public.attest_swell_watch_provider_run(gen_random_uuid(),v_set,'accepted','fixture-reviewer',repeat('c',64),'fixture-contract');
    RAISE EXCEPTION 'superseded acceptance unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'cannot accept a superseded provider revision' THEN RAISE; END IF;
  END;
END;
$$;

-- Unavailable slots retain frozen coverage but cannot become detection evidence.
DO $$
DECLARE
  v_scopes jsonb; v_tampered jsonb; v_set uuid; v_repeat uuid; v_batch uuid;
  v_point integer; v_hour integer; v_rejected boolean; v_count integer;
BEGIN
  v_scopes := public.fixture_provider_run_scopes('2026-09-05T06:00Z',1.4,1,
    p_secondary_height=>0,p_secondary_period=>0,p_secondary_direction=>0);
  FOR v_point IN 0..1 LOOP
    FOR v_hour IN 0..23 LOOP
      v_scopes := jsonb_set(v_scopes,ARRAY[v_point::text,'receipt','observations',v_hour::text,'components','1','unavailableReason'],'"provider_zero_tuple"');
    END LOOP;
  END LOOP;
  SELECT revision_set_id INTO v_set FROM public.record_swell_watch_provider_run_receipt(v_scopes);
  SELECT revision_set_id INTO v_repeat FROM public.record_swell_watch_provider_run_receipt(v_scopes);
  IF v_set IS DISTINCT FROM v_repeat THEN RAISE EXCEPTION 'unavailable replay changed revision identity'; END IF;
  SELECT count(*) INTO v_count FROM public.swell_watch_provider_run_revision_components component
    JOIN public.swell_watch_provider_run_revision_set_members member ON member.revision_id=component.revision_id WHERE member.revision_set_id=v_set;
  IF v_count <> 96 THEN RAISE EXCEPTION 'unavailable slots were dropped from frozen scope'; END IF;
  SELECT count(*) INTO v_count FROM public.swell_watch_provider_run_revision_components component
    JOIN public.swell_watch_provider_run_revision_set_members member ON member.revision_id=component.revision_id
    WHERE member.revision_set_id=v_set AND component.unavailable_reason='provider_zero_tuple' AND component.height_m=0 AND component.period_s=0 AND component.direction_deg=0;
  IF v_count <> 48 THEN RAISE EXCEPTION 'unavailable raw tuple or reason changed'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.swell_watch_provider_run_revisions revision
    JOIN public.swell_watch_provider_run_revision_set_members member ON member.revision_id=revision.id
    JOIN public.swell_watch_provider_run_batch_scopes scope ON scope.id=revision.scope_id
    WHERE member.revision_set_id=v_set AND (revision.semantic_payload->>'latitude')::numeric IS DISTINCT FROM scope.requested_lat
  ) THEN RAISE EXCEPTION 'source scopes reused another source semantic payload'; END IF;

  v_tampered := v_scopes #- '{0,receipt,observations,0,components,1,unavailableReason}';
  v_rejected := false;
  BEGIN PERFORM public.record_swell_watch_provider_run_receipt(v_tampered);
  EXCEPTION WHEN raise_exception THEN v_rejected := SQLERRM='provider receipt component provenance is invalid'; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'unmarked zero tuple was accepted'; END IF;
  v_tampered := jsonb_set(v_scopes,'{0,receipt,observations,0,components,0,unavailableReason}','"provider_zero_tuple"');
  v_rejected := false;
  BEGIN PERFORM public.record_swell_watch_provider_run_receipt(v_tampered);
  EXCEPTION WHEN raise_exception THEN v_rejected := SQLERRM='provider receipt component provenance is invalid'; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'valid tuple mislabeled unavailable was accepted'; END IF;
  v_tampered := jsonb_set(v_scopes,'{0,receipt,observations,0,components,1,unavailableReason}','null');
  v_rejected := false;
  BEGIN PERFORM public.record_swell_watch_provider_run_receipt(v_tampered);
  EXCEPTION WHEN raise_exception THEN v_rejected := SQLERRM='provider receipt component provenance is invalid'; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'null unavailable reason bypassed validation'; END IF;

  v_rejected := false;
  BEGIN PERFORM public.complete_swell_watch_provider_run_receipt(v_set);
  EXCEPTION WHEN raise_exception THEN v_rejected := SQLERRM='active accepted attestation is required'; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'unavailable receipt auto-qualified'; END IF;
  PERFORM public.attest_swell_watch_provider_run(gen_random_uuid(),v_set,'accepted','fixture-only-reviewer',repeat('d',64),'fixture-only-contract');
  SELECT provider_batch_id INTO v_batch FROM public.complete_swell_watch_provider_run_receipt(v_set);
  SELECT count(*) INTO v_count FROM public.read_swell_watch_attested_components(v_batch,'11111111-1111-4111-8111-111111111111','2026-09-05T06:00Z');
  IF v_count <> 1 THEN RAISE EXCEPTION 'unavailable component leaked into attested read'; END IF;
  v_rejected := false;
  BEGIN
    PERFORM public.ingest_verified_swell_watch_evaluation(v_batch,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'11111111-1111-4111-8111-111111111111','unavailable-region','unavailable-physical','2026-09-05T06:00Z','s2',0,0,0,2,'fixture-policy',repeat('a',64),repeat('b',64),'2026-09-08T06:00Z','2026-09-09T06:00Z');
  EXCEPTION WHEN raise_exception THEN v_rejected := SQLERRM='invalid swell watch evaluation input'; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'unavailable partition advanced detection'; END IF;
  IF EXISTS (SELECT 1 FROM public.swell_watch_observations WHERE provider_batch_id=v_batch) THEN RAISE EXCEPTION 'failed unavailable ingestion left observations'; END IF;
END;
$$;
