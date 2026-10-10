-- Sub-floor tracking authority/record checks against the real receipt, completion and demand RPCs (disposable database only).
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

-- Sub-floor tracking: the record function binds trackingMode/trackingEvents to the authority.
CREATE FUNCTION public.tracking_install(p_epoch bigint, p_mode text, p_hash_mode text DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,target_days,tracking_mode)
  VALUES(p_epoch,'active',repeat('a',64),public.study_cohort(),public.study_inputs(),
    encode(extensions.digest((jsonb_build_object('policyHash',repeat('a',64),'cohort',public.study_cohort(),'scopeInputs',public.study_inputs(),
      'forecastDays',7,'targetDays',30,'providerContractRef','fixture trusted acquisition contract','evidenceSha256',repeat('b',64))
      || CASE WHEN coalesce(p_hash_mode,p_mode)='none' THEN '{}'::jsonb ELSE jsonb_build_object('trackingMode',coalesce(p_hash_mode,p_mode)) END)::text,'sha256'),'hex'),
    'fixture trusted acquisition contract',repeat('b',64),'fixture',now()-interval '10 days',now()+interval '30 days',30,p_mode);
$$;
CREATE FUNCTION public.tracking_output(p_batch uuid, p_evaluation text, p_observed timestamptz, p_pairs bigint) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('providerBatchId',p_batch,'policyHash',repeat('a',64),'status','evaluated','reason',NULL,'enqueued',0,'sendEligibility','not_evaluated',
    'scopeOutcomes',(SELECT jsonb_agg(jsonb_build_object('sourcePointId',s->>'sourcePointId','status','derived','reason',NULL)) FROM jsonb_array_elements(public.study_cohort()) s),
    'derivation',jsonb_build_object('qualificationRule','complete_partitions.v1','scopes',
      (SELECT jsonb_agg(jsonb_build_object('sourcePointId',s->>'sourcePointId','partitionCoverage',
        '{"s1":{"observed":168,"unavailable":0,"absent":0},"s2":{"observed":168,"unavailable":0,"absent":0,"unavailableNativeFrames":[],"absentNativeFrames":[]}}'::jsonb))
        FROM jsonb_array_elements(public.study_cohort()) s)),
    'evaluationIds',jsonb_build_array(p_evaluation),'candidateCount',0,'stableRegionalEventCount',0,'preSafetyRecipientsThisEvaluation',0,
    'suppressionReasons','{}'::jsonb,'projectedSendsRolling24Hours',NULL,'deliveryHealth',NULL,
    'safety','{"reasonCode":null,"missingMetrics":["projected_send_window","delivery_health"]}'::jsonb,
    'recordedDemand',jsonb_build_object('observedAt',p_observed,'recipientEventPairs24Hours',p_pairs));
$$;
CREATE FUNCTION public.tracking_event(p_source uuid) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('sourcePointId',p_source,'sourceSlot','s1','phase','approaching','onsetObserved',true,
    'arrivalAt','2026-10-05T10:00:00.000Z','peakAt','2026-10-05T16:00:00.000Z','heightM',1.4,'periodS',13,'directionDeg',210,'heightFt',4.6,'projectedFaceHeightFt',5.1,
    'arrivalWindow',jsonb_build_object('earliestAt','2026-10-05T07:00:00.000Z','latestAt','2026-10-05T10:00:00.000Z'),
    'peakWindow',jsonb_build_object('earliestAt','2026-10-05T13:00:00.000Z','latestAt','2026-10-05T19:00:00.000Z'),'closureWindow',NULL);
$$;

-- Legacy authorities keep their exact config hash (default tracking_mode adds no key).
SELECT public.tracking_install(1,'none');
SELECT public.study_assert((SELECT config_hash FROM public.swell_watch_study_authorities WHERE epoch=1)=
  encode(extensions.digest(jsonb_build_object('policyHash',repeat('a',64),'cohort',public.study_cohort(),'scopeInputs',public.study_inputs(),'forecastDays',7,'targetDays',30,
    'providerContractRef','fixture trusted acquisition contract','evidenceSha256',repeat('b',64))::text,'sha256'),'hex'),'default epoch hash is the legacy formula');
SELECT public.study_assert(public.read_swell_watch_study_health()->>'trackingMode'='none' AND public.read_swell_watch_study_health()->>'status'='active','default health exposes none');
-- A tracking authority must bind the mode into its config hash, and a none authority must not claim it.
SELECT public.study_error($q$SELECT public.tracking_install(2,'sub_floor_tracking.v1','none')$q$,'study config hash or cohort ordering mismatch');
SELECT public.study_error($q$SELECT public.tracking_install(2,'none','sub_floor_tracking.v1')$q$,'study config hash or cohort ordering mismatch');
SELECT public.study_error($q$SELECT public.tracking_install(2,'unknown')$q$,'swell_watch_study_authorities_tracking_mode_check');

DO $$
DECLARE r record; c record; demand record; run_at timestamptz; output jsonb; ev jsonb; slot integer;
BEGIN
  FOR slot IN 0..1 LOOP
    IF slot=1 THEN PERFORM public.tracking_install(2,'sub_floor_tracking.v1'); END IF;
    run_at:=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'-interval '1 day'+slot*interval '6 hours';
    SELECT * INTO r FROM public.record_swell_watch_provider_run_receipt(public.study_receipt(run_at));
    SET LOCAL ROLE service_role;
    SELECT * INTO c FROM public.complete_swell_watch_study_run(r.revision_set_id,repeat('a',64),public.study_cohort(),public.study_inputs());
    SELECT * INTO demand FROM public.record_swell_watch_shadow_demand(c.provider_batch_id,repeat('a',64),'[]');
    RESET ROLE;
    output:=public.tracking_output(c.provider_batch_id,c.evaluation_id,demand.observed_at,demand.recorded_pairs_24h);
    ev:=public.tracking_event((public.study_cohort()->0->>'sourcePointId')::uuid);
    IF slot=0 THEN
      -- Default authority: any tracking key is rejected, so a leaked flag cannot write tracking rows.
      PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,public.study_inputs())',c.provider_batch_id,repeat('a',64),output||jsonb_build_object('trackingEvents','[]'::jsonb)),'study tracking requires a tracking authority');
      PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,public.study_inputs())',c.provider_batch_id,repeat('a',64),output||jsonb_build_object('trackingMode','sub_floor_tracking.v1')),'study tracking requires a tracking authority');
      SET LOCAL ROLE service_role;
      PERFORM public.study_assert(public.record_swell_watch_study_evaluation(c.provider_batch_id,repeat('a',64),output,public.study_inputs())='{"recorded":true}'::jsonb,'default result without tracking records');
      RESET ROLE;
      PERFORM public.study_assert(NOT (SELECT result ? 'trackingEvents' OR result ? 'trackingMode' FROM public.swell_watch_study_evaluations WHERE provider_batch_id=c.provider_batch_id),'default result stored without tracking keys');
    ELSE
      PERFORM public.study_assert(public.read_swell_watch_study_health()->>'trackingMode'='sub_floor_tracking.v1','tracking health exposes mode');
      PERFORM public.study_assert((public.read_swell_watch_study_health()->>'cycleStartEpoch')::int=1,'tracking-only epoch continues the cycle');
      PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,public.study_inputs())',c.provider_batch_id,repeat('a',64),output),'invalid study tracking events');
      PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,public.study_inputs())',c.provider_batch_id,repeat('a',64),output||jsonb_build_object('trackingMode','none','trackingEvents','[]'::jsonb)),'invalid study tracking events');
      PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,public.study_inputs())',c.provider_batch_id,repeat('a',64),output||jsonb_build_object('trackingMode','sub_floor_tracking.v1','trackingEvents','{}'::jsonb)),'invalid study tracking events');
      PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,public.study_inputs())',c.provider_batch_id,repeat('a',64),output||jsonb_build_object('trackingMode','sub_floor_tracking.v1','trackingEvents',jsonb_build_array(jsonb_set(ev,'{sourcePointId}','"00000000-0000-4000-8000-0000000000ff"')))),'invalid study tracking events');
      PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,public.study_inputs())',c.provider_batch_id,repeat('a',64),output||jsonb_build_object('trackingMode','sub_floor_tracking.v1','trackingEvents',jsonb_build_array(jsonb_set(ev,'{phase}','"candidate"')))),'invalid study tracking events');
      PERFORM public.study_error(format('SELECT public.record_swell_watch_study_evaluation(%L,%L,%L,public.study_inputs())',c.provider_batch_id,repeat('a',64),output||jsonb_build_object('trackingMode','sub_floor_tracking.v1','trackingEvents',(SELECT jsonb_agg(ev) FROM generate_series(1,101)))),'invalid study tracking events');
      PERFORM public.study_assert(NOT EXISTS(SELECT 1 FROM public.swell_watch_study_evaluations WHERE provider_batch_id=c.provider_batch_id),'rejected tracking results leave no ledger row');
      SET LOCAL ROLE service_role;
      PERFORM public.study_assert(public.record_swell_watch_study_evaluation(c.provider_batch_id,repeat('a',64),output||jsonb_build_object('trackingMode','sub_floor_tracking.v1','trackingEvents',jsonb_build_array(ev)),public.study_inputs())='{"recorded":true}'::jsonb,'tracking result records');
      RESET ROLE;
      PERFORM public.study_assert((SELECT result->'trackingEvents'->0->>'phase' FROM public.swell_watch_study_evaluations WHERE provider_batch_id=c.provider_batch_id)='approaching','tracking events retained in the ledger');
      PERFORM public.study_assert((SELECT count(*) FROM public.swell_watch_event_impacts)=0,'tracking writes no event impacts');
    END IF;
  END LOOP;
END $$;
