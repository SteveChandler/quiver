-- Real receipt/attestation/completion/demand RPCs against the minimal existing fixture schema.
CREATE FUNCTION public.study_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'assertion failed: %',label; END IF; END; $$;
CREATE FUNCTION public.study_error(statement text,expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF position(expected IN SQLERRM)>0 THEN RETURN; END IF;
    RAISE EXCEPTION 'expected %, got %',expected,SQLERRM;
  END;
  RAISE EXCEPTION 'expected failure: %',expected;
END; $$;

SELECT public.study_assert(public.read_swell_watch_study_health()->>'status'='unconfigured','unseeded authority');
SELECT public.study_assert(NOT has_function_privilege('service_role','public.attest_swell_watch_provider_run(uuid,uuid,text,text,text,text,uuid)','EXECUTE'),'no broad attestation grant');
SELECT public.study_assert(NOT has_table_privilege('service_role','public.swell_watch_study_authorities','INSERT'),'no authority write');
SELECT public.study_assert(NOT has_table_privilege('service_role','public.swell_watch_study_evaluations','INSERT'),'no ledger write');
SET ROLE anon;
SELECT public.study_error('SELECT public.read_swell_watch_study_health()','permission denied');
RESET ROLE;
SET ROLE authenticated;
SELECT public.study_error('SELECT public.complete_swell_watch_study_run(NULL,NULL,NULL,NULL)','permission denied');
RESET ROLE;

INSERT INTO public.beaches(id) SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM generate_series(1,10) n;
CREATE FUNCTION public.study_cohort() RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_agg(jsonb_build_object('sourcePointId','00000000-0000-4000-8000-'||lpad(n::text,12,'0'),'regionKey','study') ORDER BY n)
  FROM generate_series(1,10) n;
$$;
CREATE FUNCTION public.study_receipt(run_at timestamptz,height numeric DEFAULT 1.2,generation numeric DEFAULT 1)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.fixture_study_scopes(to_char(run_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"'),height,generation,
    ARRAY(SELECT (s->>'sourcePointId')::uuid FROM jsonb_array_elements(public.study_cohort()) s));
$$;
CREATE FUNCTION public.study_inputs() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT public.swell_watch_study_scope_inputs(public.study_cohort());
$$;
INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
VALUES(1,'active',repeat('a',64),'{"volume_caps":{"maximum_candidates_per_region":50,"maximum_recipients_per_event":1000,"maximum_projected_sends_per_window":1000},"provider_failure_hold":{"window_minutes":60,"maximum_failure_rate":0.05,"minimum_samples":20},"staleness":{"maximum_forecast_age_hours":48},"cadence":{"evaluation_interval_minutes":60},"partition_matching":{"maximum_arrival_delta_hours":6,"maximum_period_delta_s":2,"maximum_direction_delta_deg":25}}',
  'fixture',repeat('b',64),now()-interval '10 days',now()+interval '40 days');
SELECT set_config('app.swell_watch_internal_write','on',false);
INSERT INTO public.swell_watch_automation_control(id,state,reason_code) VALUES(gen_random_uuid(),'disabled','study_fixture');
CREATE FUNCTION public.study_install(epoch bigint,state text DEFAULT 'active',expires timestamptz DEFAULT now()+interval '30 days',target integer DEFAULT 30)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,target_days)
  VALUES(epoch,state,repeat('a',64),public.study_cohort(),public.study_inputs(),encode(extensions.digest(jsonb_build_object('policyHash',repeat('a',64),'cohort',public.study_cohort(),'scopeInputs',public.study_inputs(),
    'forecastDays',7,'targetDays',target,'providerContractRef','fixture trusted acquisition contract','evidenceSha256',repeat('b',64))::text,'sha256'),'hex'),
    'fixture trusted acquisition contract',repeat('b',64),'fixture',now()-interval '10 days',expires,target);
$$;
SELECT public.study_install(1,'active',now()+interval '30 days',1);
SELECT public.study_assert(public.read_swell_watch_study_health()->>'status'='active','configured active');
CREATE FUNCTION public.study_fail_completion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'fixture forced completion failure'; END; $$;

CREATE TABLE public.study_test_ids(run_utc timestamptz,revision_set_id uuid,provider_batch_id uuid);
GRANT SELECT ON public.study_test_ids TO service_role;
DO $$
DECLARE r record; run_at timestamptz; raw_revision uuid; payload jsonb;
BEGIN
  run_at:=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'-interval '8 days';
  SELECT * INTO r FROM public.record_swell_watch_provider_run_receipt(public.study_receipt(run_at));
  PERFORM public.study_error(format('SELECT public.complete_swell_watch_study_run(%L,%L,%L,public.study_inputs())',r.revision_set_id,repeat('a',64),public.study_cohort()),'study run is stale');
  PERFORM public.study_assert(NOT EXISTS(SELECT 1 FROM public.swell_watch_provider_run_attestations WHERE revision_set_id=r.revision_set_id),'stale leaves zero attestation');
  PERFORM public.study_assert(NOT EXISTS(SELECT 1 FROM public.swell_watch_provider_run_completed_batches WHERE revision_set_id=r.revision_set_id),'stale leaves zero completion');
  -- First run of today is fresh; exercise immutable evidence integrity before accepting it.
  run_at:=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  SELECT * INTO r FROM public.record_swell_watch_provider_run_receipt(public.study_receipt(run_at));
  SELECT revision_id INTO raw_revision FROM public.swell_watch_provider_run_revision_set_members WHERE revision_set_id=r.revision_set_id LIMIT 1;
  PERFORM public.study_error(format('SELECT public.complete_swell_watch_study_run(%L,%L,%L,%L)',r.revision_set_id,repeat('a',64),public.study_cohort(),jsonb_set(public.study_inputs(),'{0,latitude}','34')),'current study config required');
  BEGIN
    UPDATE public.beaches SET lat=34 WHERE id='00000000-0000-4000-8000-000000000001';
    PERFORM public.study_error(format('SELECT public.complete_swell_watch_study_run(%L,%L,%L,public.study_inputs())',r.revision_set_id,repeat('a',64),public.study_cohort()),'current study config required');
    PERFORM public.study_assert(NOT EXISTS(SELECT 1 FROM public.swell_watch_study_acceptances WHERE revision_set_id=r.revision_set_id),'changed current coordinates cannot acquire study acceptance');
    RAISE no_data_found;
  EXCEPTION WHEN no_data_found THEN NULL; END;
  BEGIN
    ALTER TABLE public.swell_watch_provider_run_batch_scopes DISABLE TRIGGER swell_watch_provider_run_scopes_append_only;
    UPDATE public.swell_watch_provider_run_batch_scopes SET requested_lat=34 WHERE batch_id=r.run_batch_id AND source_point_id='00000000-0000-4000-8000-000000000001';
    PERFORM public.study_error(format('SELECT public.complete_swell_watch_study_run(%L,%L,%L,public.study_inputs())',r.revision_set_id,repeat('a',64),public.study_cohort()),'coverage or raw evidence invalid');
    RAISE no_data_found;
  EXCEPTION WHEN no_data_found THEN NULL; END;
  BEGIN
    ALTER TABLE public.swell_watch_provider_run_revision_components DISABLE TRIGGER swell_watch_provider_run_components_append_only;
    DELETE FROM public.swell_watch_provider_run_revision_components WHERE id=(SELECT id FROM public.swell_watch_provider_run_revision_components WHERE revision_id=raw_revision LIMIT 1);
    PERFORM public.study_error(format('SELECT public.complete_swell_watch_study_run(%L,%L,%L,public.study_inputs())',r.revision_set_id,repeat('a',64),public.study_cohort()),'coverage or raw evidence invalid');
    RAISE no_data_found;
  EXCEPTION WHEN no_data_found THEN NULL; END;
  BEGIN
    CREATE TRIGGER study_fixture_fail BEFORE INSERT ON public.swell_watch_provider_run_completed_batches
      FOR EACH ROW EXECUTE FUNCTION public.study_fail_completion();
    PERFORM public.study_error(format('SELECT public.complete_swell_watch_study_run(%L,%L,%L,public.study_inputs())',r.revision_set_id,repeat('a',64),public.study_cohort()),'fixture forced completion failure');
    PERFORM public.study_assert(NOT EXISTS(SELECT 1 FROM public.swell_watch_provider_run_attestations WHERE revision_set_id=r.revision_set_id),'completion failure rolls back attestation');
    PERFORM public.study_assert(NOT EXISTS(SELECT 1 FROM public.swell_watch_study_acceptances WHERE revision_set_id=r.revision_set_id),'completion failure rolls back binding');
    RAISE no_data_found;
  EXCEPTION WHEN no_data_found THEN NULL; END;
  BEGIN
    ALTER TABLE public.swell_watch_study_authorities DISABLE TRIGGER swell_watch_study_authority_guard;
    UPDATE public.swell_watch_study_authorities SET not_before=clock_timestamp() WHERE epoch=1;
    PERFORM public.complete_swell_watch_study_run(r.revision_set_id,repeat('a',64),public.study_cohort(),public.study_inputs());
    PERFORM public.study_assert(EXISTS(SELECT 1 FROM public.swell_watch_provider_run_completed_batches WHERE revision_set_id=r.revision_set_id),'fresh preactivation issuance completes');
    PERFORM public.study_assert(public.read_swell_watch_study_health()->>'qualifyingDays'='0','preactivation issuance does not qualify');
    RAISE no_data_found;
  EXCEPTION WHEN no_data_found THEN NULL; END;
  BEGIN
    ALTER TABLE public.swell_watch_provider_run_revision_raw_responses DISABLE TRIGGER swell_watch_provider_run_raw_responses_append_only;
    DELETE FROM public.swell_watch_provider_run_revision_raw_responses WHERE revision_id=raw_revision;
    PERFORM public.study_error(format('SELECT public.complete_swell_watch_study_run(%L,%L,%L,public.study_inputs())',r.revision_set_id,repeat('a',64),public.study_cohort()),'raw evidence invalid');
    RAISE no_data_found;
  EXCEPTION WHEN no_data_found THEN NULL; END;
  BEGIN
    ALTER TABLE public.swell_watch_provider_run_revision_raw_responses DISABLE TRIGGER swell_watch_provider_run_raw_responses_append_only;
    SELECT (raw_response::jsonb||'{"elevation":999}')::text INTO payload FROM public.swell_watch_provider_run_revision_raw_responses WHERE revision_id=raw_revision LIMIT 1;
    UPDATE public.swell_watch_provider_run_revision_raw_responses SET raw_response=payload #>> '{}',raw_response_sha256=encode(extensions.digest(payload #>> '{}','sha256'),'hex') WHERE revision_id=raw_revision;
    PERFORM public.study_error(format('SELECT public.complete_swell_watch_study_run(%L,%L,%L,public.study_inputs())',r.revision_set_id,repeat('a',64),public.study_cohort()),'raw evidence invalid');
    RAISE no_data_found;
  EXCEPTION WHEN no_data_found THEN NULL; END;
END; $$;
DO $$
DECLARE r record; c record; run_at timestamptz; output jsonb; demand record; first_set uuid; old_manifest jsonb; field text; bad jsonb; frozen jsonb;
BEGIN
  -- Four distinct issuances on yesterday's UTC day; current policy allows their recording age.
  FOR slot IN 0..3 LOOP
    run_at:=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'-interval '1 day'+slot*interval '6 hours';
    SELECT * INTO r FROM public.record_swell_watch_provider_run_receipt(public.study_receipt(run_at));
    IF slot=1 THEN
      PERFORM public.record_swell_watch_provider_run_receipt(public.study_receipt(run_at,1.2,2));
    END IF;
    IF slot=0 THEN
      PERFORM public.study_error(format('SELECT public.complete_swell_watch_study_run(%L,%L,%L,public.study_inputs())',r.revision_set_id,repeat('a',64),'[]'),'current study config');
      PERFORM public.study_error(format('SELECT public.complete_swell_watch_study_run(%L,%L,%L,public.study_inputs())',r.revision_set_id,repeat('f',64),public.study_cohort()),'current study config');
    END IF;
    SET LOCAL ROLE service_role;
    SELECT * INTO c FROM public.complete_swell_watch_study_run(r.revision_set_id,repeat('a',64),public.study_cohort(),public.study_inputs());
    PERFORM public.study_assert(c.already_evaluated=false,'initial completion not evaluated');
    RESET ROLE;
    INSERT INTO public.study_test_ids VALUES(run_at,r.revision_set_id,c.provider_batch_id);
    IF slot=1 THEN
      PERFORM public.study_assert((SELECT jsonb_array_length(evidence_manifest->'rawEvidence') FROM public.swell_watch_study_acceptances WHERE revision_set_id=r.revision_set_id)=20,'multiple raw hashes accepted');
    END IF;
    output:=jsonb_build_object('providerBatchId',c.provider_batch_id,'policyHash',repeat('a',64),'status','suppressed','reason','missing_partition',
      'enqueued',0,'sendEligibility','not_evaluated','scopeOutcomes',(SELECT jsonb_agg(jsonb_build_object('sourcePointId',s->>'sourcePointId','status','suppressed','reason','missing_partition')) FROM jsonb_array_elements(public.study_cohort()) s));
    SET LOCAL ROLE service_role;
    PERFORM public.study_assert(public.record_swell_watch_study_evaluation(c.provider_batch_id,repeat('a',64),output,public.study_inputs())='{"recorded":true}'::jsonb,'suppressed recorded');
    PERFORM public.record_swell_watch_study_evaluation(c.provider_batch_id,repeat('a',64),output,public.study_inputs());
    SELECT * INTO c FROM public.complete_swell_watch_study_run(r.revision_set_id,repeat('a',64),public.study_cohort(),public.study_inputs());
    PERFORM public.study_assert(NOT c.already_evaluated,'suppressed retry permitted');
    RESET ROLE;
    output:=output||jsonb_build_object('status','evaluated','reason',NULL,'scopeOutcomes',(SELECT jsonb_agg(jsonb_build_object('sourcePointId',s->>'sourcePointId','status','derived','reason',NULL)) FROM jsonb_array_elements(public.study_cohort()) s),
      'evaluationIds',jsonb_build_array(c.evaluation_id),'candidateCount',0,'stableRegionalEventCount',0,'preSafetyRecipientsThisEvaluation',0,
      'suppressionReasons','{}'::jsonb,'projectedSendsRolling24Hours',NULL,'deliveryHealth',NULL,
      'safety','{"reasonCode":null,"missingMetrics":["projected_send_window","delivery_health"]}'::jsonb);
    PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,public.study_inputs())',c.provider_batch_id,repeat('a',64),output),'fresh evaluated study demand');
    SET LOCAL ROLE service_role;
    SELECT * INTO demand FROM public.record_swell_watch_shadow_demand(c.provider_batch_id,repeat('a',64),'[]');
    RESET ROLE;
    output:=output||jsonb_build_object('recordedDemand',jsonb_build_object('observedAt',demand.observed_at,'recipientEventPairs24Hours',demand.recorded_pairs_24h));
    IF slot=0 THEN
      FOREACH field IN ARRAY ARRAY['evaluationIds','candidateCount','stableRegionalEventCount','preSafetyRecipientsThisEvaluation','suppressionReasons','safety','projectedSendsRolling24Hours','deliveryHealth'] LOOP
        PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,public.study_inputs())',c.provider_batch_id,repeat('a',64),output-field),'complete successful study result required');
      END LOOP;
      FOREACH field IN ARRAY ARRAY['candidateCount','stableRegionalEventCount','preSafetyRecipientsThisEvaluation'] LOOP
        FOR bad IN SELECT value FROM jsonb_array_elements('[null,-1,0.5,"unknown",9007199254740992]') LOOP
          PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,public.study_inputs())',c.provider_batch_id,repeat('a',64),jsonb_set(output,ARRAY[field],bad)),'complete successful study result required');
        END LOOP;
      END LOOP;
      PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,public.study_inputs())',c.provider_batch_id,repeat('a',64),jsonb_set(output,'{evaluationIds}','["genuine_completed:wrong"]')),'complete successful study result required');
      FOR bad IN SELECT value FROM jsonb_array_elements('[{}, {"reasonCode":null}, {"missingMetrics":["projected_send_window","delivery_health"]}, {"reasonCode":null,"missingMetrics":[]}, {"reasonCode":"unknown","missingMetrics":["projected_send_window","delivery_health"]}]') LOOP
        PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,public.study_inputs())',c.provider_batch_id,repeat('a',64),jsonb_set(output,'{safety}',bad)),'invalid study safety');
      END LOOP;
      FOR bad IN SELECT value FROM jsonb_array_elements('[{"missing":-1},{"missing":0.5},{"missing":null},{"missing":"unknown"}]') LOOP
        PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,public.study_inputs())',c.provider_batch_id,repeat('a',64),jsonb_set(output,'{suppressionReasons}',bad)),'invalid study safety');
      END LOOP;
      frozen:=public.study_inputs();
      PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,%L)',c.provider_batch_id,repeat('a',64),output,jsonb_set(frozen,'{0,latitude}','34')),'current study authority and evidence required');
      BEGIN
        UPDATE public.beaches SET deepwater_decay_factor=0.9 WHERE id='00000000-0000-4000-8000-000000000001';
        PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,%L)',c.provider_batch_id,repeat('a',64),output,frozen),'current study authority and evidence required');
        PERFORM public.study_assert(NOT public.swell_watch_provider_evidence_is_current(c.provider_batch_id),'terrain change invalidates current study');
        RAISE no_data_found;
      EXCEPTION WHEN no_data_found THEN NULL; END;
    END IF;
    PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,public.study_inputs())',c.provider_batch_id,repeat('a',64),jsonb_set(output,'{scopeOutcomes}','[]')),'invalid study scope');
    PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,public.study_inputs())',c.provider_batch_id,repeat('a',64),output||'{"enqueued":1}'),'invalid study result');
    PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,public.study_inputs())',c.provider_batch_id,repeat('a',64),jsonb_set(output,'{recordedDemand,recipientEventPairs24Hours}','99')),'fresh evaluated study demand');
    IF slot=0 THEN
      BEGIN
        INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
          SELECT 2,state,policy_hash,jsonb_set(policy_values,'{staleness,maximum_forecast_age_hours}','0.01'),reviewer,evidence_hash,not_before,expires_at
          FROM public.swell_watch_evaluation_policies WHERE epoch=1;
        PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,public.study_inputs())',c.provider_batch_id,repeat('a',64),output),'fresh evaluated study demand');
        PERFORM public.study_assert(NOT EXISTS(SELECT 1 FROM public.swell_watch_study_evaluations e WHERE e.provider_batch_id=c.provider_batch_id AND e.status='evaluated'),'stale result never qualifies');
        RAISE no_data_found;
      EXCEPTION WHEN no_data_found THEN NULL; END;
    END IF;
    SET LOCAL ROLE service_role;
    PERFORM public.record_swell_watch_study_evaluation(c.provider_batch_id,repeat('a',64),output,public.study_inputs());
    PERFORM public.record_swell_watch_study_evaluation(c.provider_batch_id,repeat('a',64),output,public.study_inputs());
    SELECT * INTO c FROM public.complete_swell_watch_study_run(r.revision_set_id,repeat('a',64),public.study_cohort(),public.study_inputs());
    PERFORM public.study_assert(c.already_evaluated,'success suppresses reevaluation');
    RESET ROLE;
    PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,public.study_inputs())',c.provider_batch_id,repeat('a',64),output||'{"candidateCount":999}'),'successful study result is immutable');
    PERFORM public.study_assert((public.read_swell_watch_study_health()->>'qualifyingDays')::int=CASE WHEN slot=3 THEN 1 ELSE 0 END,'four issuances required');
    IF slot=0 THEN
      SELECT evidence_manifest INTO old_manifest FROM public.swell_watch_study_acceptances WHERE revision_set_id=r.revision_set_id;
      SELECT revision_set_id INTO first_set FROM public.record_swell_watch_provider_run_receipt(public.study_receipt(run_at,1.2,99));
      PERFORM public.study_assert(first_set=r.revision_set_id,'raw-only retry same semantic revision');
      PERFORM public.complete_swell_watch_study_run(first_set,repeat('a',64),public.study_cohort(),public.study_inputs());
      PERFORM public.study_assert(old_manifest=(SELECT evidence_manifest FROM public.swell_watch_study_acceptances WHERE revision_set_id=first_set),'evidence subset immutable after raw append');
    END IF;
  END LOOP;
END; $$;
SELECT public.study_assert((SELECT count(*) FROM public.swell_watch_study_evaluations)=8,'retries add no rows');
SELECT public.study_assert((SELECT count(*) FROM public.swell_watch_provider_run_attestations)=4,'one machine attestation per revision');
SELECT public.study_assert((SELECT count(*) FROM public.notification_events)=0,'no notifications');
SELECT public.study_assert((SELECT count(*) FROM public.swell_watch_production_approval_authority)=0,'no push authority');
SELECT public.study_assert(public.read_swell_watch_study_health()->>'status'='complete','target reached');
SELECT public.study_assert(public.read_swell_watch_study_health()->>'evaluatedRuns'='4','health successful count');
SELECT public.study_assert(public.read_swell_watch_study_health()->>'suppressedAttempts'='4','health suppressed count');
DO $$
DECLARE r public.study_test_ids; c record;
BEGIN
  -- A successful exact retry is acknowledged even after the policy freshness window narrows.
  BEGIN
    INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
      SELECT 2,state,policy_hash,jsonb_set(policy_values,'{staleness,maximum_forecast_age_hours}','0.01'),reviewer,evidence_hash,not_before,expires_at
      FROM public.swell_watch_evaluation_policies WHERE epoch=1;
    SELECT * INTO r FROM public.study_test_ids ORDER BY run_utc LIMIT 1;
    SELECT * INTO c FROM public.complete_swell_watch_study_run(r.revision_set_id,repeat('a',64),public.study_cohort(),public.study_inputs());
    PERFORM public.study_assert(c.already_evaluated,'stale exact success retry acknowledged');
    RAISE no_data_found;
  EXCEPTION WHEN no_data_found THEN NULL; END;
  BEGIN
    INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
      SELECT 2,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,now()-interval '1 hour'
      FROM public.swell_watch_evaluation_policies WHERE epoch=1;
    PERFORM public.study_assert(public.read_swell_watch_study_health()->>'status'='complete','natural policy expiry preserves achievement');
    RAISE no_data_found;
  EXCEPTION WHEN no_data_found THEN NULL; END;
  BEGIN
    ALTER TABLE public.swell_watch_study_authorities DISABLE TRIGGER swell_watch_study_authority_guard;
    UPDATE public.swell_watch_study_authorities SET expires_at=now()-interval '1 minute' WHERE epoch=1;
    PERFORM public.study_assert(public.read_swell_watch_study_health()->>'status'='complete','natural authority expiry preserves achievement');
    RAISE no_data_found;
  EXCEPTION WHEN no_data_found THEN NULL; END;
  BEGIN
    ALTER TABLE public.swell_watch_study_authorities DISABLE TRIGGER swell_watch_study_authority_guard;
    UPDATE public.swell_watch_study_authorities SET not_before=(SELECT min(run_utc)+interval '1 second' FROM public.study_test_ids) WHERE epoch=1;
    PERFORM public.study_assert(public.read_swell_watch_study_health()->>'qualifyingDays'='0','partial first UTC study day excluded');
    RAISE no_data_found;
  EXCEPTION WHEN no_data_found THEN NULL; END;
END; $$;
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.record_swell_watch_provider_run_receipt(public.study_receipt(date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'));
  PERFORM public.study_error(format('SELECT public.complete_swell_watch_study_run(%L,%L,%L,public.study_inputs())',r.revision_set_id,repeat('a',64),public.study_cohort()),'study is not active');
  PERFORM public.study_assert(NOT EXISTS(SELECT 1 FROM public.swell_watch_provider_run_attestations WHERE revision_set_id=r.revision_set_id),'target leaves zero acceptance');
END; $$;

-- Owner rejection and revocation cannot be bypassed with another accepted row or retry.
DO $$
DECLARE r public.study_test_ids; accepted uuid;
BEGIN
  SELECT * INTO r FROM public.study_test_ids ORDER BY run_utc LIMIT 1;
  SELECT attestation_id INTO accepted FROM public.swell_watch_study_acceptances WHERE revision_set_id=r.revision_set_id;
  PERFORM public.attest_swell_watch_provider_run(gen_random_uuid(),r.revision_set_id,'revoked','fixture',repeat('b',64),'fixture',accepted);
  PERFORM public.study_error(format('SELECT public.complete_swell_watch_study_run(%L,%L,%L,public.study_inputs())',r.revision_set_id,repeat('a',64),public.study_cohort()),'held by rejection or revocation');
  PERFORM public.study_assert(NOT public.swell_watch_provider_evidence_is_current(r.provider_batch_id),'revocation invalidates evidence');
  PERFORM public.study_assert(public.read_swell_watch_study_health()->>'qualifyingDays'='0','revocation removes qualifying day');
  SELECT * INTO r FROM public.study_test_ids ORDER BY run_utc LIMIT 1 OFFSET 1;
  PERFORM public.attest_swell_watch_provider_run(gen_random_uuid(),r.revision_set_id,'rejected','fixture',repeat('b',64),'fixture');
  PERFORM public.study_assert(NOT public.swell_watch_provider_evidence_is_current(r.provider_batch_id),'rejection holds accepted evidence');
  SELECT * INTO r FROM public.study_test_ids ORDER BY run_utc LIMIT 1 OFFSET 2;
  PERFORM public.record_swell_watch_provider_run_receipt(public.study_receipt(r.run_utc,2));
  PERFORM public.study_error(format('SELECT public.complete_swell_watch_study_run(%L,%L,%L,public.study_inputs())',r.revision_set_id,repeat('a',64),public.study_cohort()),'invalid current study revision');
END; $$;
SELECT public.study_install(2,'revoked');
SELECT public.study_assert(public.read_swell_watch_study_health()->>'status'='blocked','authority revocation health');
SELECT public.study_assert(NOT public.swell_watch_provider_evidence_is_current((SELECT provider_batch_id FROM public.study_test_ids ORDER BY run_utc DESC LIMIT 1)),'authority revocation invalidates evidence');
DO $$
DECLARE r public.study_test_ids;
BEGIN
  SELECT * INTO r FROM public.study_test_ids ORDER BY run_utc DESC LIMIT 1;
  SET LOCAL ROLE service_role;
  PERFORM public.study_error(format('SELECT public.ingest_verified_swell_watch_evaluation(%L,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),%L,%L,%L,%L,%L,1.2,12,170,2,%L,%L,%L,%L,%L)',
    r.provider_batch_id,'00000000-0000-4000-8000-000000000001','study','fixture',r.run_utc,'s1','fixture',repeat('a',64),repeat('b',64),r.run_utc+interval '3 days',r.run_utc+interval '4 days'),
    'current study evidence required');
  RESET ROLE;
END; $$;
SELECT public.study_install(3,'active',now()-interval '1 day');
SELECT public.study_assert(public.read_swell_watch_study_health()->>'status'='expired','expiry is readable');
SELECT public.study_error('UPDATE public.swell_watch_study_authorities SET reviewer=''other''','append only');
SELECT public.study_error('DELETE FROM public.swell_watch_study_evaluations','append-only');
SELECT public.study_install(4);
CREATE TABLE public.study_pending AS SELECT * FROM public.record_swell_watch_provider_run_receipt(
  public.study_receipt(date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'));
GRANT SELECT ON public.study_pending TO service_role;
DO $$
DECLARE r public.study_pending;
BEGIN
  SELECT * INTO r FROM public.study_pending;
  BEGIN
    INSERT INTO public.swell_watch_production_approval_authority(record_id,authority_id,authority_epoch,state,policy_hash,policy_provenance,
      policy_values,approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at)
      SELECT gen_random_uuid(),gen_random_uuid(),1,'active',policy_hash,'production_approved',policy_values,'fixture',evidence_hash,
        'swell_watch_push','fixture',not_before,expires_at FROM public.swell_watch_evaluation_policies WHERE epoch=1;
    PERFORM public.study_error(format('SELECT public.complete_swell_watch_study_run(%L,%L,%L,public.study_inputs())',r.revision_set_id,repeat('a',64),public.study_cohort()),'current study config required');
    RAISE no_data_found;
  EXCEPTION WHEN no_data_found THEN NULL; END;
  BEGIN
    INSERT INTO public.swell_watch_automation_control(id,state,reason_code,created_at) VALUES(gen_random_uuid(),'shadow','fixture',clock_timestamp()+interval '1 second');
    PERFORM public.study_error(format('SELECT public.complete_swell_watch_study_run(%L,%L,%L,public.study_inputs())',r.revision_set_id,repeat('a',64),public.study_cohort()),'current study config required');
    RAISE no_data_found;
  EXCEPTION WHEN no_data_found THEN NULL; END;
  BEGIN
    INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
      SELECT 2,state,repeat('f',64),policy_values,reviewer,evidence_hash,not_before,expires_at FROM public.swell_watch_evaluation_policies WHERE epoch=1;
    PERFORM public.study_error(format('SELECT public.complete_swell_watch_study_run(%L,%L,%L,public.study_inputs())',r.revision_set_id,repeat('a',64),public.study_cohort()),'current study config required');
    RAISE no_data_found;
  EXCEPTION WHEN no_data_found THEN NULL; END;
END; $$;
CREATE FUNCTION public.study_complete_retry() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  FOR attempt IN 1..20 LOOP
    BEGIN
      PERFORM public.complete_swell_watch_study_run((SELECT revision_set_id FROM public.study_pending),repeat('a',64),public.study_cohort(),public.study_inputs());
      RETURN;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM<>'provider completion is busy; retry transaction' THEN RAISE; END IF;
    END;
    PERFORM pg_sleep(0.05);
  END LOOP;
  RAISE EXCEPTION 'concurrent completion never became available';
END; $$;

CREATE FUNCTION public.study_probe_legacy_ingestion(expect_revoked boolean) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  component record; statement text; rejected boolean:=false; release record; event_id uuid;
  v_observation_id uuid:=gen_random_uuid(); v_impact_id uuid:=gen_random_uuid();
  observations_before bigint; impacts_before bigint;
BEGIN
  SELECT b.id AS provider_batch_id,s.source_point_id,c.* INTO STRICT component
    FROM public.study_pending pending
    JOIN public.swell_watch_provider_run_completed_batches b ON b.revision_set_id=pending.revision_set_id
    JOIN public.swell_watch_provider_run_revision_set_members m ON m.revision_set_id=b.revision_set_id
    JOIN public.swell_watch_provider_run_batch_scopes s ON s.id=m.scope_id
    JOIN public.swell_watch_provider_run_revision_components c ON c.revision_id=m.revision_id
    WHERE s.source_point_id='00000000-0000-4000-8000-000000000001' AND c.source_slot='s1'
    ORDER BY c.forecast_at LIMIT 1 OFFSET CASE WHEN expect_revoked THEN 1 ELSE 0 END;
  SELECT count(*) INTO observations_before FROM public.swell_watch_observations;
  SELECT count(*) INTO impacts_before FROM public.swell_watch_beach_impacts;
  statement:=format('SELECT public.ingest_verified_swell_watch_evaluation(%L,%L,%L,gen_random_uuid(),%L,%L,%L,%L,%L,%L,%L,%L,2,%L,%L,%L,%L,%L)',
    component.provider_batch_id,v_observation_id,v_impact_id,component.source_point_id,'study','legacy-guard-fixture',
    component.forecast_at,component.source_slot,component.height_m,component.period_s,component.direction_deg,
    'fixture',repeat('a',64),repeat('b',64),component.forecast_at+interval '3 days',component.forecast_at+interval '4 days');
  SET LOCAL ROLE service_role;
  PERFORM public.study_assert(current_user='service_role','legacy probe executes as service role');
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN raise_exception THEN
    IF NOT expect_revoked OR SQLERRM<>'current study evidence required' THEN RAISE; END IF;
    rejected:=true;
  END;
  RESET ROLE;
  PERFORM public.study_assert(rejected=expect_revoked,'legacy guard exact rejection');
  PERFORM public.study_assert((SELECT count(*) FROM public.swell_watch_observations)=observations_before+CASE WHEN expect_revoked THEN 0 ELSE 1 END,'legacy observation write count');
  PERFORM public.study_assert((SELECT count(*) FROM public.swell_watch_beach_impacts)=impacts_before+CASE WHEN expect_revoked THEN 0 ELSE 1 END,'legacy impact write count');
  IF NOT expect_revoked THEN
    PERFORM public.study_assert(EXISTS(SELECT 1 FROM public.swell_watch_observations o
      JOIN public.swell_watch_beach_impacts i ON i.observation_id=o.id
      WHERE o.id=v_observation_id AND i.id=v_impact_id AND o.provider_batch_id=component.provider_batch_id),
      'active legacy ingestion stores verified batch and linked impact');
    SELECT e.regional_event_id INTO STRICT event_id FROM public.swell_watch_event_impacts e WHERE e.beach_impact_id=v_impact_id;
    SET LOCAL ROLE service_role;
    SELECT * INTO release FROM public.swell_watch_validate_notification_release(event_id,component.source_point_id,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',component.forecast_at,gen_random_uuid());
    RESET ROLE;
    PERFORM public.study_assert(release.allowed=false,'real notification release rejects study event');
    PERFORM public.study_assert((SELECT count(*) FROM public.notification_events)=0,'study release creates no notification');
  END IF;
END; $$;

CREATE TABLE public.study_manual_batch(provider_batch_id uuid);
DO $$
DECLARE r record; c record; run_at timestamptz;
BEGIN
  run_at:=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'-interval '9 days';
  SELECT * INTO r FROM public.record_swell_watch_provider_run_receipt(public.fixture_study_scopes(to_char(run_at,'YYYY-MM-DD"T"HH24:MI"Z"'),1.2));
  PERFORM public.attest_swell_watch_provider_run(gen_random_uuid(),r.revision_set_id,'accepted','manual fixture',repeat('b',64),'manual contract');
  SET LOCAL ROLE service_role;
  SELECT * INTO c FROM public.complete_swell_watch_provider_run_receipt(r.revision_set_id);
  PERFORM public.ingest_verified_swell_watch_evaluation(c.provider_batch_id,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),
    '11111111-1111-4111-8111-111111111111','manual','manual-fixture',run_at,'s1',1.2,12,170,2,'fixture',repeat('a',64),repeat('b',64),run_at+interval '3 days',run_at+interval '4 days');
  RESET ROLE;
  INSERT INTO public.study_manual_batch VALUES(c.provider_batch_id);
  PERFORM public.study_assert(public.swell_watch_provider_evidence_is_current(c.provider_batch_id),'manual nonstudy evidence remains current');
  PERFORM public.study_assert(EXISTS(SELECT 1 FROM public.swell_watch_observations WHERE provider_batch_id=c.provider_batch_id),'manual nonstudy ingestion remains available');
END; $$;

-- This block rolls back its receipts so the subsequent concurrency fixture stays fixed.
DO $$
DECLARE base timestamptz; ids uuid[]:='{}'; r record; c record; pending jsonb; demand record; output jsonb; accepted uuid; replacement uuid;
BEGIN
  BEGIN
    base:=to_timestamp(floor(extract(epoch FROM clock_timestamp())/21600)*21600);
    FOR slot IN 0..4 LOOP
      SELECT * INTO r FROM public.record_swell_watch_provider_run_receipt(public.study_receipt(base-slot*interval '6 hours',3+slot));
      ids:=array_append(ids,r.revision_set_id);
    END LOOP;
    SET LOCAL ROLE service_role;
    pending:=public.read_swell_watch_study_pending_runs(repeat('a',64));
    RESET ROLE;
    PERFORM public.study_assert(pending=jsonb_build_array(jsonb_build_object('revision_set_id',ids[5]),jsonb_build_object('revision_set_id',ids[4]),jsonb_build_object('revision_set_id',ids[3])),
      'pending oldest first max three includes raw receipts');
    SELECT * INTO c FROM public.complete_swell_watch_study_run(ids[5],repeat('a',64),public.study_cohort(),public.study_inputs());
    PERFORM public.study_assert(public.read_swell_watch_study_pending_runs(repeat('a',64))=pending,'accepted without result remains pending');
    SELECT * INTO demand FROM public.record_swell_watch_shadow_demand(c.provider_batch_id,repeat('a',64),'[]');
    output:=jsonb_build_object('providerBatchId',c.provider_batch_id,'policyHash',repeat('a',64),'status','evaluated','reason',NULL,
      'enqueued',0,'sendEligibility','not_evaluated','evaluationIds',jsonb_build_array(c.evaluation_id),
      'candidateCount',0,'stableRegionalEventCount',0,'preSafetyRecipientsThisEvaluation',0,'suppressionReasons','{}'::jsonb,
      'projectedSendsRolling24Hours',NULL,'deliveryHealth',NULL,'safety','{"reasonCode":null,"missingMetrics":["projected_send_window","delivery_health"]}'::jsonb,
      'scopeOutcomes',(SELECT jsonb_agg(jsonb_build_object('sourcePointId',s->>'sourcePointId','status','derived','reason',NULL)) FROM jsonb_array_elements(public.study_cohort()) s),
      'recordedDemand',jsonb_build_object('observedAt',demand.observed_at,'recipientEventPairs24Hours',demand.recorded_pairs_24h));
    PERFORM public.record_swell_watch_study_evaluation(c.provider_batch_id,repeat('a',64),output,public.study_inputs());
    PERFORM public.study_assert(NOT public.read_swell_watch_study_pending_runs(repeat('a',64)) @> jsonb_build_array(jsonb_build_object('revision_set_id',ids[5])),'successful result not pending');
    PERFORM public.attest_swell_watch_provider_run(gen_random_uuid(),ids[4],'rejected','fixture',repeat('b',64),'fixture');
    accepted:=gen_random_uuid();
    PERFORM public.attest_swell_watch_provider_run(accepted,ids[3],'accepted','fixture',repeat('b',64),'fixture');
    PERFORM public.attest_swell_watch_provider_run(gen_random_uuid(),ids[3],'revoked','fixture',repeat('b',64),'fixture',accepted);
    SELECT revision_set_id INTO replacement FROM public.record_swell_watch_provider_run_receipt(public.study_receipt(base-interval '6 hours',9));
    pending:=public.read_swell_watch_study_pending_runs(repeat('a',64));
    PERFORM public.study_assert(pending=jsonb_build_array(jsonb_build_object('revision_set_id',replacement),jsonb_build_object('revision_set_id',ids[1])),
      'pending excludes rejected revoked and superseded revisions');
    INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
      SELECT 2,state,policy_hash,jsonb_set(policy_values,'{staleness,maximum_forecast_age_hours}','6'),reviewer,evidence_hash,not_before,expires_at
      FROM public.swell_watch_evaluation_policies WHERE epoch=1;
    PERFORM public.study_assert(public.read_swell_watch_study_pending_runs(repeat('a',64))=jsonb_build_array(jsonb_build_object('revision_set_id',ids[1])),
      'pending excludes stale receipts');
    RAISE no_data_found;
  EXCEPTION WHEN no_data_found THEN NULL; END;
END; $$;
