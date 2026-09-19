-- Safe study-cycle continuity, runtime bounds, recovery backoff, and pinned scope inputs.
-- All function changes are hash-guarded against the reviewed epoch-5 schema.
-- Reviewed body hashes (pre -> post, before runtime timeout ALTER FUNCTION statements):
-- swell_watch_provider_evidence_is_current f59409463e431ee5485c336b113944e73fe9497563157adb2fcec75184cbffc9 -> 069ec0bf40d66182ff4ef3c6bc87550ddc2f29706b9129bfc86c720921e20345
-- read_swell_watch_study_health b2789dfdb0637335290be5883ef57f19e2889cfa071d1ecbadd6ad9b72b30c01 -> f21df04b9d6bc609590f0ab9124b849a46710493e58fa4ba71f1f8d8fcd27dc8
-- complete_swell_watch_study_run 58c3a7bb5b32a0bcb3c7ab1d95678bcc93dcde2bd2763feec24ee2cffd44d85c -> c6c5a29b834f23762e6509a2cc09701026726ae3cc79613b0b74ce2d19c96e7b
-- record_swell_watch_study_evaluation d1165986abe16e5c177a4d778dfa0f23ddd9d2b7407ee81c07755e39364c9f03 -> 783c4973bb51591f7629ae1ec67729390adc33f4405910ffc8c39f1cffa1337d
-- read_swell_watch_study_pending_runs bb6fd6011ad2505b6307468e95d51992993dbb9cc0fa796d10e47c4c5e3e6e39 -> 1881fb9299c3fa91f7a0b60c782439f49c026890d4344f8775778141a439e0a2
-- resolve_and_ingest_swell_watch_evaluation fbb618bc867533b9cfb61c2d676c2430a9d6926e04623daf5da7c8e802d9f00b -> 9ad173f153dec99bb8d8f7bdf4710a54c66ecf732300756b8d6c9ac8f8c324a0
-- advance_swell_watch_event 30884e1bf78ebd1d35f4c36f30b7b93ef622d76d71d14a25cc9d445f6d5c9d18 -> 78bca1572d81dfb07d7e6112514f698f5079b613c08cc8f715b9f5803db027d4
-- record_swell_watch_shadow_demand 414be8da27827b45d94d090176c3518ca1a8759db52b21630e11290da5c23375 -> a0988e626f8813aaed74e932d5850e35dde846153c9b9ee3306c778657482931 (or timeout-adjusted 343ffc9289a607a6707bf46f4204025a1cb5fe21c8feb5e02a454b86d022c79a)
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL standard_conforming_strings='off'; -- exact byte-for-byte function-body replacements below

DO $$ BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.swell_watch_study_cycle_start(p_epoch bigint)
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE current_authority public.swell_watch_study_authorities; prior public.swell_watch_study_authorities; start_epoch bigint;
BEGIN
  SELECT * INTO current_authority FROM public.swell_watch_study_authorities WHERE epoch=p_epoch;
  IF NOT FOUND OR current_authority.state<>'active' THEN RETURN NULL; END IF;
  start_epoch := p_epoch;
  LOOP
    SELECT * INTO prior FROM public.swell_watch_study_authorities WHERE epoch=start_epoch-1;
    EXIT WHEN NOT FOUND OR prior.state<>'active'
      OR prior.policy_hash IS DISTINCT FROM current_authority.policy_hash
      OR prior.qualification_rule IS DISTINCT FROM current_authority.qualification_rule
      OR prior.cohort IS DISTINCT FROM current_authority.cohort
      OR prior.scope_inputs IS DISTINCT FROM current_authority.scope_inputs
      OR prior.target_days IS DISTINCT FROM current_authority.target_days;
    start_epoch := start_epoch-1;
  END LOOP;
  RETURN start_epoch;
END;
$$;

CREATE TABLE IF NOT EXISTS public.swell_watch_study_recovery_failures (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  revision_set_id uuid NOT NULL REFERENCES public.swell_watch_provider_run_revision_sets(id),
  failed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  code text NOT NULL CHECK (char_length(btrim(code)) BETWEEN 1 AND 100)
);
CREATE INDEX IF NOT EXISTS swell_watch_study_recovery_failures_revision_time
  ON public.swell_watch_study_recovery_failures(revision_set_id,failed_at DESC);
ALTER TABLE public.swell_watch_study_recovery_failures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.swell_watch_study_recovery_failures FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS swell_watch_study_recovery_failures_append_only ON public.swell_watch_study_recovery_failures;
CREATE TRIGGER swell_watch_study_recovery_failures_append_only BEFORE INSERT OR UPDATE OR DELETE
  ON public.swell_watch_study_recovery_failures FOR EACH ROW EXECUTE FUNCTION public.swell_watch_append_only_trigger();

CREATE OR REPLACE FUNCTION public.record_swell_watch_study_recovery_failure(p_revision_set_id uuid,p_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF p_revision_set_id IS NULL OR p_code IS NULL OR char_length(btrim(p_code)) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'invalid study recovery failure';
  END IF;
  PERFORM set_config('app.swell_watch_internal_write','on',true);
  INSERT INTO public.swell_watch_study_recovery_failures(revision_set_id,code) VALUES(p_revision_set_id,btrim(p_code));
END;
$$;
REVOKE ALL ON FUNCTION public.record_swell_watch_study_recovery_failure(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_swell_watch_study_recovery_failure(uuid,text) TO service_role;

CREATE TABLE IF NOT EXISTS public.swell_watch_shadow_demand_observations (
  provider_batch_id uuid NOT NULL REFERENCES public.swell_watch_provider_run_completed_batches(id),
  policy_hash text NOT NULL CHECK (policy_hash ~ '^[a-f0-9]{64}$'),
  regional_event_id uuid NOT NULL REFERENCES public.swell_watch_regional_events(id),
  recipient_id uuid NOT NULL REFERENCES auth.users(id),
  observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(provider_batch_id,policy_hash,regional_event_id,recipient_id)
);
CREATE INDEX IF NOT EXISTS swell_watch_shadow_demand_observations_time
  ON public.swell_watch_shadow_demand_observations(observed_at);
ALTER TABLE public.swell_watch_shadow_demand_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.swell_watch_shadow_demand_observations FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS swell_watch_shadow_demand_observations_append_only ON public.swell_watch_shadow_demand_observations;
CREATE TRIGGER swell_watch_shadow_demand_observations_append_only BEFORE INSERT OR UPDATE OR DELETE
  ON public.swell_watch_shadow_demand_observations FOR EACH ROW EXECUTE FUNCTION public.swell_watch_append_only_trigger();

-- swell_watch_provider_evidence_is_current(uuid): pre f59409463e431ee5485c336b113944e73fe9497563157adb2fcec75184cbffc9; post 069ec0bf40d66182ff4ef3c6bc87550ddc2f29706b9129bfc86c720921e20345.
DO $amend$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.swell_watch_provider_evidence_is_current(uuid)'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex')='069ec0bf40d66182ff4ef3c6bc87550ddc2f29706b9129bfc86c720921e20345' THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'f59409463e431ee5485c336b113944e73fe9497563157adb2fcec75184cbffc9' THEN RAISE EXCEPTION 'provider evidence definition differs from reviewed baseline'; END IF;
  definition := $definition$CREATE OR REPLACE FUNCTION public.swell_watch_provider_evidence_is_current(p_provider_batch_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.swell_watch_provider_evidence_is_current_before_study(p_provider_batch_id)
    AND NOT EXISTS(SELECT 1 FROM public.swell_watch_provider_run_completed_batches b
      JOIN public.swell_watch_study_acceptances s ON s.revision_set_id=b.revision_set_id
      JOIN public.swell_watch_study_authorities accepted ON accepted.epoch=s.authority_epoch
      JOIN public.swell_watch_study_authorities current_authority ON current_authority.epoch=(SELECT max(epoch) FROM public.swell_watch_study_authorities)
      WHERE b.id=p_provider_batch_id AND (
        current_authority.state<>'active'
        OR accepted.epoch NOT BETWEEN public.swell_watch_study_cycle_start(current_authority.epoch) AND current_authority.epoch
        OR accepted.policy_hash IS DISTINCT FROM current_authority.policy_hash
        OR NOT EXISTS(SELECT 1 FROM public.swell_watch_current_study_authority(current_authority.policy_hash) c WHERE c.epoch=current_authority.epoch)
        OR EXISTS(SELECT 1 FROM public.swell_watch_provider_run_attestations t
          WHERE t.revision_set_id=s.revision_set_id AND t.state IN ('rejected','revoked'))));
$function$
$definition$;
  EXECUTE definition;
  IF encode(extensions.digest(pg_get_functiondef('public.swell_watch_provider_evidence_is_current(uuid)'::regprocedure),'sha256'),'hex')<>'069ec0bf40d66182ff4ef3c6bc87550ddc2f29706b9129bfc86c720921e20345' THEN RAISE EXCEPTION 'provider evidence definition hash mismatch'; END IF;
END;
$amend$;

-- read_swell_watch_study_health(): pre b2789dfdb0637335290be5883ef57f19e2889cfa071d1ecbadd6ad9b72b30c01; post f21df04b9d6bc609590f0ab9124b849a46710493e58fa4ba71f1f8d8fcd27dc8.
DO $amend$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.read_swell_watch_study_health()'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex') IN ('f21df04b9d6bc609590f0ab9124b849a46710493e58fa4ba71f1f8d8fcd27dc8','a58dc043ec7df36533ed6955ae7584fe4aed81ec89fa6acb345bff0031fea563') THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'b2789dfdb0637335290be5883ef57f19e2889cfa071d1ecbadd6ad9b72b30c01' THEN RAISE EXCEPTION 'study health definition differs from reviewed baseline'; END IF;
  definition := $definition$CREATE OR REPLACE FUNCTION public.read_swell_watch_study_health()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE a public.swell_watch_study_authorities; start_epoch bigint; cycle_before timestamptz; days jsonb; policy_expiry timestamptz; health_status text; reason text; outcomes jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT * INTO a FROM public.swell_watch_study_authorities ORDER BY epoch DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unconfigured','qualifyingDays',0,'targetDays',30,
    'qualifyingDates','[]'::jsonb,'authorityEpoch',NULL,'policyHash',NULL,'qualificationRule',NULL,'cycleStartEpoch',NULL,'cycleNotBefore',NULL,'reason','study_authority_missing',
    'evaluatedRuns',0,'suppressedAttempts',0,'lastEvaluatedAt',NULL,'lastSuppressedAt',NULL); END IF;
  start_epoch := public.swell_watch_study_cycle_start(a.epoch);
  SELECT not_before INTO cycle_before FROM public.swell_watch_study_authorities WHERE epoch=start_epoch;
  SELECT expires_at INTO policy_expiry FROM public.swell_watch_evaluation_policies ORDER BY epoch DESC LIMIT 1;
  SELECT coalesce(jsonb_agg(day ORDER BY day),'[]'::jsonb) INTO days FROM (
    SELECT (i.run_utc AT TIME ZONE 'UTC')::date AS day
    FROM public.swell_watch_study_evaluations e
    JOIN public.swell_watch_provider_run_completed_batches b ON b.id=e.provider_batch_id
    JOIN public.swell_watch_provider_run_batches rb ON rb.id=b.batch_id
    JOIN public.swell_watch_provider_run_issuances i ON i.id=rb.issuance_id
    WHERE e.status='evaluated' AND e.policy_hash=a.policy_hash AND e.authority_epoch BETWEEN start_epoch AND a.epoch
      AND i.run_utc>=cycle_before AND public.swell_watch_provider_evidence_is_current_before_study(e.provider_batch_id)
    GROUP BY (i.run_utc AT TIME ZONE 'UTC')::date HAVING count(DISTINCT i.run_utc)=4
  ) qualified;
  SELECT jsonb_build_object('evaluatedRuns',count(*) FILTER(WHERE e.status='evaluated'),
    'suppressedAttempts',count(*) FILTER(WHERE e.status='suppressed'),
    'lastEvaluatedAt',max(e.recorded_at) FILTER(WHERE e.status='evaluated'),
    'lastSuppressedAt',max(e.recorded_at) FILTER(WHERE e.status='suppressed')) INTO outcomes
    FROM public.swell_watch_study_evaluations e WHERE e.authority_epoch BETWEEN start_epoch AND a.epoch AND e.policy_hash=a.policy_hash;
  IF a.state='revoked' THEN health_status:='blocked'; reason:='study_authority_revoked';
  ELSIF NOT EXISTS(SELECT 1 FROM public.swell_watch_evaluation_policies p WHERE p.epoch=(SELECT max(epoch) FROM public.swell_watch_evaluation_policies) AND p.state='active' AND p.policy_hash=a.policy_hash) THEN health_status:='blocked'; reason:='study_policy_changed';
  ELSIF jsonb_array_length(days)>=a.target_days THEN health_status:='complete'; reason:='target_reached';
  ELSIF clock_timestamp()>=a.expires_at OR clock_timestamp()>=policy_expiry THEN health_status:='expired'; reason:='study_or_policy_expired';
  ELSIF NOT EXISTS(SELECT 1 FROM public.swell_watch_current_study_authority(a.policy_hash)) THEN health_status:='blocked'; reason:='study_policy_or_control_unavailable';
  ELSE health_status:='active'; reason:=NULL; END IF;
  RETURN jsonb_build_object('status',health_status,'authorityEpoch',a.epoch,'policyHash',a.policy_hash,'qualificationRule',a.qualification_rule,
    'cycleStartEpoch',start_epoch,'cycleNotBefore',cycle_before,'qualifyingDays',jsonb_array_length(days),'qualifyingDates',days,'targetDays',a.target_days,'reason',reason,
    'expiresAt',least(a.expires_at,policy_expiry)) || outcomes;
END;
$function$
$definition$;
  EXECUTE definition;
  IF encode(extensions.digest(pg_get_functiondef('public.read_swell_watch_study_health()'::regprocedure),'sha256'),'hex')<>'f21df04b9d6bc609590f0ab9124b849a46710493e58fa4ba71f1f8d8fcd27dc8' THEN RAISE EXCEPTION 'study health definition hash mismatch'; END IF;
END;
$amend$;

-- complete_swell_watch_study_run(uuid,text,jsonb,jsonb): pre 58c3a7bb5b32a0bcb3c7ab1d95678bcc93dcde2bd2763feec24ee2cffd44d85c; post c6c5a29b834f23762e6509a2cc09701026726ae3cc79613b0b74ce2d19c96e7b.
DO $amend$
DECLARE definition text; acl aclitem[];
BEGIN
  SELECT pg_get_functiondef('public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb)'::regprocedure),proacl INTO definition,acl FROM pg_proc WHERE oid='public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb)'::regprocedure;
  IF encode(extensions.digest(definition,'sha256'),'hex') IN ('c6c5a29b834f23762e6509a2cc09701026726ae3cc79613b0b74ce2d19c96e7b','7c4b7e0522a7d89157beda0a76b7760a0e62920ad2e7a2b7a45981da79544bfb') THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'58c3a7bb5b32a0bcb3c7ab1d95678bcc93dcde2bd2763feec24ee2cffd44d85c' THEN RAISE EXCEPTION 'study completion definition differs from reviewed baseline'; END IF;
  definition := replace(definition, 'RETURNS TABLE(provider_batch_id uuid, evaluation_id text, already_evaluated boolean)', 'RETURNS TABLE(provider_batch_id uuid, evaluation_id text, already_evaluated boolean, authority_epoch bigint, qualification_rule text)');
  definition := replace(definition, 'DECLARE a public.swell_watch_study_authorities; r record; manifest jsonb; attestation uuid; completed record; max_age interval;', 'DECLARE a public.swell_watch_study_authorities; r record; manifest jsonb; attestation uuid; completed record; max_age interval; cycle_start bigint; cycle_before timestamptz;');
  definition := replace(definition, E'  SELECT * INTO a FROM public.swell_watch_current_study_authority(p_policy_hash);\n  IF NOT FOUND OR a.cohort IS DISTINCT FROM p_cohort OR a.scope_inputs IS DISTINCT FROM p_scope_inputs THEN\n    RAISE EXCEPTION ''current study config required''; END IF;', E'  SELECT * INTO a FROM public.swell_watch_current_study_authority(p_policy_hash);\n  IF NOT FOUND THEN RAISE EXCEPTION ''current study config required''; END IF;\n  cycle_start := public.swell_watch_study_cycle_start(a.epoch);\n  SELECT not_before INTO cycle_before FROM public.swell_watch_study_authorities WHERE epoch=cycle_start;\n  IF a.cohort IS DISTINCT FROM p_cohort OR a.scope_inputs IS DISTINCT FROM p_scope_inputs THEN RAISE EXCEPTION ''current study config required''; END IF;\n  IF cycle_start IS NULL OR cycle_before IS NULL OR r.run_utc < cycle_before THEN RAISE EXCEPTION ''study run predates current study cycle''; END IF;');
  definition := replace(definition, 's.authority_epoch=a.epoch', 's.authority_epoch BETWEEN cycle_start AND a.epoch');
  definition := replace(definition, 'RETURN QUERY SELECT completed.provider_batch_id,completed.evaluation_id,true;', 'RETURN QUERY SELECT completed.provider_batch_id,completed.evaluation_id,true,a.epoch,a.qualification_rule;');
  definition := replace(definition, 'RETURN QUERY SELECT completed.provider_batch_id,completed.evaluation_id,EXISTS(', 'RETURN QUERY SELECT completed.provider_batch_id,completed.evaluation_id,EXISTS(');
  definition := replace(definition, E'      AND e.policy_hash=p_policy_hash AND e.status=''evaluated'');\nEND;', E'      AND e.policy_hash=p_policy_hash AND e.status=''evaluated''),a.epoch,a.qualification_rule;\nEND;');
  DROP FUNCTION public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb);
  EXECUTE definition;
  REVOKE ALL ON FUNCTION public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
  GRANT EXECUTE ON FUNCTION public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb) TO service_role;
  IF encode(extensions.digest(pg_get_functiondef('public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb)'::regprocedure),'sha256'),'hex')<>'c6c5a29b834f23762e6509a2cc09701026726ae3cc79613b0b74ce2d19c96e7b' THEN RAISE EXCEPTION 'study completion definition hash mismatch'; END IF;
END;
$amend$;

-- record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb): pre d1165986abe16e5c177a4d778dfa0f23ddd9d2b7407ee81c07755e39364c9f03; post 783c4973bb51591f7629ae1ec67729390adc33f4405910ffc8c39f1cffa1337d.
DO $amend$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex') IN ('783c4973bb51591f7629ae1ec67729390adc33f4405910ffc8c39f1cffa1337d','bf9e59e110593b66364be08057b3b34a936e9ab5d01bf9311158434230c5ab3f') THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'d1165986abe16e5c177a4d778dfa0f23ddd9d2b7407ee81c07755e39364c9f03' THEN RAISE EXCEPTION 'study recording definition differs from reviewed baseline'; END IF;
  definition := replace(definition, 'DECLARE a public.swell_watch_study_authorities; run_at timestamptz; measured_at timestamptz; digest text; demand public.swell_watch_shadow_demand_runs; raw_batch uuid; scope jsonb; slot text; observed numeric; unavailable numeric; absent numeric; stored_zero_tuples bigint; stored_invalid_absent bigint;', 'DECLARE a public.swell_watch_study_authorities; run_at timestamptz; measured_at timestamptz; digest text; demand public.swell_watch_shadow_demand_runs; raw_batch uuid; scope jsonb; slot text; observed numeric; unavailable numeric; absent numeric; stored_zero_tuples bigint; stored_invalid_absent bigint; cycle_start bigint;');
  definition := replace(definition, '  SELECT * INTO a FROM public.swell_watch_current_study_authority(p_policy_hash);\n  IF NOT FOUND OR public.swell_watch_provider_evidence_is_current(p_provider_batch_id) IS DISTINCT FROM true\n    OR a.scope_inputs IS DISTINCT FROM p_scope_inputs\n    OR NOT EXISTS(SELECT 1 FROM public.swell_watch_provider_run_completed_batches b\n      JOIN public.swell_watch_study_acceptances s ON s.revision_set_id=b.revision_set_id\n      WHERE b.id=p_provider_batch_id AND s.authority_epoch=a.epoch) THEN', '  SELECT * INTO a FROM public.swell_watch_current_study_authority(p_policy_hash);\n  IF NOT FOUND THEN RAISE EXCEPTION ''current study authority and evidence required''; END IF;\n  cycle_start := public.swell_watch_study_cycle_start(a.epoch);\n  IF public.swell_watch_provider_evidence_is_current(p_provider_batch_id) IS DISTINCT FROM true\n    OR a.scope_inputs IS DISTINCT FROM p_scope_inputs\n    OR NOT EXISTS(SELECT 1 FROM public.swell_watch_provider_run_completed_batches b\n      JOIN public.swell_watch_study_acceptances s ON s.revision_set_id=b.revision_set_id\n      WHERE b.id=p_provider_batch_id AND s.authority_epoch BETWEEN cycle_start AND a.epoch) THEN');
  EXECUTE definition;
  IF encode(extensions.digest(pg_get_functiondef('public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)'::regprocedure),'sha256'),'hex')<>'783c4973bb51591f7629ae1ec67729390adc33f4405910ffc8c39f1cffa1337d' THEN RAISE EXCEPTION 'study recording definition hash mismatch'; END IF;
END;
$amend$;

-- read_swell_watch_study_pending_runs(text): pre bb6fd6011ad2505b6307468e95d51992993dbb9cc0fa796d10e47c4c5e3e6e39; post 1881fb9299c3fa91f7a0b60c782439f49c026890d4344f8775778141a439e0a2.
DO $amend$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.read_swell_watch_study_pending_runs(text)'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex') IN ('1881fb9299c3fa91f7a0b60c782439f49c026890d4344f8775778141a439e0a2','1f19ab40a3e2658739ef6a2eec144e40fcb0d33cb763f12639d6ba303287ce15') THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'bb6fd6011ad2505b6307468e95d51992993dbb9cc0fa796d10e47c4c5e3e6e39' THEN RAISE EXCEPTION 'study pending definition differs from reviewed baseline'; END IF;
  definition := replace(definition, 'DECLARE a public.swell_watch_study_authorities; pending jsonb; max_age interval;', 'DECLARE a public.swell_watch_study_authorities; pending jsonb; max_age interval; cycle_start bigint; cycle_before timestamptz;');
  definition := replace(definition, '  SELECT * INTO a FROM public.swell_watch_current_study_authority(p_policy_hash);\n  IF NOT FOUND THEN RAISE EXCEPTION ''current study config required''; END IF;', '  SELECT * INTO a FROM public.swell_watch_current_study_authority(p_policy_hash);\n  IF NOT FOUND THEN RAISE EXCEPTION ''current study config required''; END IF;\n  cycle_start := public.swell_watch_study_cycle_start(a.epoch);\n  SELECT not_before INTO cycle_before FROM public.swell_watch_study_authorities WHERE epoch=cycle_start;');
  definition := replace(definition, '      AND i.run_utc<=clock_timestamp() AND i.run_utc>=clock_timestamp()-max_age', '      AND i.run_utc<=clock_timestamp() AND i.run_utc>=greatest(clock_timestamp()-max_age,cycle_before)');
  definition := replace(definition, '      AND NOT EXISTS(SELECT 1 FROM public.swell_watch_study_acceptances s WHERE s.revision_set_id=rs.id AND s.authority_epoch<>a.epoch)', '      AND NOT EXISTS(SELECT 1 FROM public.swell_watch_study_acceptances s WHERE s.revision_set_id=rs.id AND s.authority_epoch NOT BETWEEN cycle_start AND a.epoch)\n      AND NOT EXISTS(SELECT 1 FROM public.swell_watch_study_recovery_failures failure WHERE failure.revision_set_id=rs.id\n        AND failure.failed_at > clock_timestamp()-make_interval(secs=>least(power(2,(SELECT count(*) FROM public.swell_watch_study_recovery_failures count_failure WHERE count_failure.revision_set_id=rs.id)-1),4)*3600))');
  EXECUTE definition;
  IF encode(extensions.digest(pg_get_functiondef('public.read_swell_watch_study_pending_runs(text)'::regprocedure),'sha256'),'hex') NOT IN ('1881fb9299c3fa91f7a0b60c782439f49c026890d4344f8775778141a439e0a2','1f19ab40a3e2658739ef6a2eec144e40fcb0d33cb763f12639d6ba303287ce15') THEN RAISE EXCEPTION 'study pending definition hash mismatch'; END IF;
END;
$amend$;

-- resolve_and_ingest_swell_watch_evaluation(...): pre fbb618bc867533b9cfb61c2d676c2430a9d6926e04623daf5da7c8e802d9f00b; post 67c5c32bbe5fc2b8f0604876c5fb9f06df4ab6a55411ee6750caf7daa60e2047.
DO $amend$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.resolve_and_ingest_swell_watch_evaluation(uuid,uuid,uuid,uuid,text,text,timestamptz,text,numeric,numeric,numeric,numeric,text,text,text,timestamptz,timestamptz)'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex') IN ('67c5c32bbe5fc2b8f0604876c5fb9f06df4ab6a55411ee6750caf7daa60e2047','b5f3300dde131554862219403c59e87b97f06df0e384fe9db5dc0b733b6646c4') THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'fbb618bc867533b9cfb61c2d676c2430a9d6926e04623daf5da7c8e802d9f00b' THEN RAISE EXCEPTION 'study resolver definition differs from reviewed baseline'; END IF;
  definition := replace(definition, '  v_max_hours numeric; v_max_period numeric; v_max_direction numeric;', '  v_max_hours numeric; v_max_period numeric; v_max_direction numeric; v_same_evaluation_beach boolean;');
  definition := replace(definition, '  IF cardinality(v_retry_ids)>1 THEN RAISE EXCEPTION ''ambiguous regional identity''; END IF;\n  IF EXISTS (', '  IF cardinality(v_retry_ids)>1 THEN RAISE EXCEPTION ''ambiguous regional identity''; END IF;\n  SELECT EXISTS(SELECT 1 FROM public.swell_watch_event_impacts association\n    JOIN public.swell_watch_beach_impacts impact ON impact.id=association.beach_impact_id\n    JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id\n    WHERE association.evaluation_id=v_evaluation AND association.beach_id=p_source_point_id\n      AND observation.provider_batch_id=p_provider_batch_id AND observation.id IS DISTINCT FROM p_observation_id) INTO v_same_evaluation_beach;\n  IF EXISTS (');
  definition := replace(definition, '  ) THEN RAISE EXCEPTION ''compatible regional identity requires current-cycle evidence''; END IF;\n  v_matches := coalesce(v_retry_ids,''{}'');', '  ) THEN RAISE EXCEPTION ''compatible regional identity requires current-cycle evidence''; END IF;\n  v_matches := coalesce(v_retry_ids,''{}'');');
  definition := replace(definition, '    IF v_reference.provider=''open_meteo'' AND abs(v_reference.period_s-p_period_s)<=v_max_period', '    IF NOT v_same_evaluation_beach AND v_reference.provider=''open_meteo'' AND abs(v_reference.period_s-p_period_s)<=v_max_period');
  definition := replace(definition, '      -- Never bypass stale/suppressed evidence or permanent dedupe by allocating a fresh ID.\n      IF public.swell_watch_provider_evidence_is_current(v_reference.provider_batch_id) IS DISTINCT FROM true\n        OR v_reference.policy_hash IS DISTINCT FROM p_policy_hash\n        OR (v_reference.run_utc > v_run AND NOT v_reference.regional_event_id=ANY(coalesce(v_retry_ids,''{}'')))\n        OR v_reference.evaluated_at <= v_reference.suppressed_at THEN\n        RAISE EXCEPTION ''compatible regional identity requires current-cycle evidence'';\n      END IF;', '      -- Aliases are an audit trail; metric matching remains the identity authority.\n      IF public.swell_watch_provider_evidence_is_current(v_reference.provider_batch_id) IS DISTINCT FROM true\n        OR v_reference.policy_hash IS DISTINCT FROM p_policy_hash\n        OR (v_reference.run_utc > v_run AND NOT v_reference.regional_event_id=ANY(coalesce(v_retry_ids,''{}'')))\n        OR v_reference.evaluated_at <= v_reference.suppressed_at THEN\n        CONTINUE;\n      END IF;');
  EXECUTE definition;
  IF encode(extensions.digest(pg_get_functiondef('public.resolve_and_ingest_swell_watch_evaluation(uuid,uuid,uuid,uuid,text,text,timestamptz,text,numeric,numeric,numeric,numeric,text,text,text,timestamptz,timestamptz)'::regprocedure),'sha256'),'hex')<>'67c5c32bbe5fc2b8f0604876c5fb9f06df4ab6a55411ee6750caf7daa60e2047' THEN RAISE EXCEPTION 'study resolver definition hash mismatch'; END IF;
END;
$amend$;

-- advance_swell_watch_event(...): pre 30884e1bf78ebd1d35f4c36f30b7b93ef622d76d71d14a25cc9d445f6d5c9d18; post 78bca1572d81dfb07d7e6112514f698f5079b613c08cc8f715b9f5803db027d4.
DO $amend$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.advance_swell_watch_event(uuid,text,uuid,timestamptz,timestamptz,uuid)'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex')='78bca1572d81dfb07d7e6112514f698f5079b613c08cc8f715b9f5803db027d4' THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'30884e1bf78ebd1d35f4c36f30b7b93ef622d76d71d14a25cc9d445f6d5c9d18' THEN RAISE EXCEPTION 'event advance definition differs from reviewed baseline'; END IF;
  definition := replace(definition, '  v_beach_id uuid;', '  v_beach_id uuid;\n  v_required integer; v_current_count integer; v_latest_stable_evaluation_id text;');
  definition := replace(definition, '  IF v_latest_state = ''stable'' THEN\n    RETURN ''stable'';\n  END IF;', '  IF v_latest_state = ''stable'' THEN\n    SELECT trigger_evaluation_id INTO v_latest_stable_evaluation_id FROM public.swell_watch_event_state_transitions WHERE regional_event_id=p_regional_event_id ORDER BY version DESC LIMIT 1;\n    IF EXISTS(SELECT 1 FROM public.swell_watch_event_evaluations evaluation\n      JOIN public.swell_watch_beach_impacts impact ON impact.id=evaluation.beach_impact_id\n      JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id\n      WHERE evaluation.regional_event_id=p_regional_event_id AND evaluation.evaluation_id=v_latest_stable_evaluation_id\n        AND public.swell_watch_provider_evidence_is_current(observation.provider_batch_id)) THEN RETURN ''stable''; END IF;\n  END IF;');
  definition := replace(definition, '  IF v_count < 2 THEN RETURN ''candidate''; END IF;', '  SELECT (policy_values #>> ''{stability,minimum_genuine_evaluations}'')::integer INTO v_required FROM public.swell_watch_get_matching_policy();\n  SELECT count(DISTINCT evaluation.evaluation_id) INTO v_current_count\n  FROM public.swell_watch_event_evaluations evaluation\n  JOIN public.swell_watch_beach_impacts impact ON impact.id=evaluation.beach_impact_id\n  JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id\n  WHERE evaluation.regional_event_id=p_regional_event_id AND evaluation.identity_kind=''genuine_completed''\n    AND public.swell_watch_provider_evidence_is_current(observation.provider_batch_id);\n  IF coalesce(v_current_count,0) < greatest(coalesce(v_required,2),2) THEN RETURN ''candidate''; END IF;');
  EXECUTE definition;
  IF encode(extensions.digest(pg_get_functiondef('public.advance_swell_watch_event(uuid,text,uuid,timestamptz,timestamptz,uuid)'::regprocedure),'sha256'),'hex')<>'78bca1572d81dfb07d7e6112514f698f5079b613c08cc8f715b9f5803db027d4' THEN RAISE EXCEPTION 'event advance definition hash mismatch'; END IF;
END;
$amend$;

-- record_swell_watch_shadow_demand(uuid,text,jsonb): pre 414be8da27827b45d94d090176c3518ca1a8759db52b21630e11290da5c23375; post a0988e626f8813aaed74e932d5850e35dde846153c9b9ee3306c778657482931.
DO $amend$
DECLARE current_hash text;
BEGIN
  SELECT encode(extensions.digest(pg_get_functiondef('public.record_swell_watch_shadow_demand(uuid,text,jsonb)'::regprocedure),'sha256'),'hex') INTO current_hash;
  IF current_hash IN ('a0988e626f8813aaed74e932d5850e35dde846153c9b9ee3306c778657482931','343ffc9289a607a6707bf46f4204025a1cb5fe21c8feb5e02a454b86d022c79a') THEN RETURN; END IF;
  IF current_hash<>'414be8da27827b45d94d090176c3518ca1a8759db52b21630e11290da5c23375' THEN RAISE EXCEPTION 'shadow demand definition differs from reviewed baseline'; END IF;
END;
$amend$;

-- Append the shadow observation ledger while retaining the original first-observed pair table.
CREATE OR REPLACE FUNCTION public.record_swell_watch_shadow_demand(p_provider_batch_id uuid,p_policy_hash text,p_pairs jsonb)
RETURNS TABLE(observed_at timestamptz,recorded_pairs_24h bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE canonical jsonb; previous public.swell_watch_shadow_demand_runs; measured_at timestamptz; total bigint; run_at timestamptz;
BEGIN
  IF jsonb_typeof(p_pairs) IS DISTINCT FROM 'array' OR jsonb_array_length(p_pairs)>10000 THEN RAISE EXCEPTION 'invalid shadow demand'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_pairs) pair WHERE jsonb_typeof(pair) IS DISTINCT FROM 'object' OR pair-'regional_event_id'-'recipient_id'<>'{}'::jsonb
    OR coalesce(pair->>'regional_event_id','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    OR coalesce(pair->>'recipient_id','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$') THEN RAISE EXCEPTION 'invalid shadow recipient/event pair'; END IF;
  SELECT coalesce(jsonb_agg(pair ORDER BY pair->>'regional_event_id',pair->>'recipient_id'),'[]'::jsonb) INTO canonical FROM (SELECT DISTINCT pair FROM jsonb_array_elements(p_pairs) pair) pairs;
  IF jsonb_array_length(canonical)<>jsonb_array_length(p_pairs) THEN RAISE EXCEPTION 'duplicate shadow pair'; END IF;
  SELECT issuance.run_utc INTO run_at FROM public.swell_watch_provider_run_completed_batches completed JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id WHERE completed.id=p_provider_batch_id;
  IF run_at IS NULL THEN RAISE EXCEPTION 'completed shadow provider run required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-provider-run:' || to_char(run_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"'),0));
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  IF NOT EXISTS(SELECT 1 FROM public.swell_watch_get_matching_policy() p WHERE p.policy_hash=p_policy_hash AND p.revoked_at IS NULL AND p.superseded_at IS NULL
    AND isfinite(p.not_before) AND isfinite(p.expires_at) AND clock_timestamp()>=p.not_before AND clock_timestamp()<p.expires_at)
    OR public.swell_watch_provider_evidence_is_current(p_provider_batch_id) IS DISTINCT FROM true THEN RAISE EXCEPTION 'current shadow policy and provider evidence required'; END IF;
  SELECT * INTO previous FROM public.swell_watch_shadow_demand_runs r WHERE r.provider_batch_id=p_provider_batch_id AND r.policy_hash=p_policy_hash;
  IF FOUND THEN
    IF previous.recipient_events IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'shadow evaluation demand changed'; END IF;
    RETURN QUERY SELECT previous.observed_at,previous.recorded_pairs_24h; RETURN;
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(canonical) pair WHERE NOT EXISTS(SELECT 1 FROM public.swell_watch_event_impacts link JOIN public.swell_watch_beach_impacts impact ON impact.id=link.beach_impact_id JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id WHERE link.regional_event_id=(pair->>'regional_event_id')::uuid AND observation.provider_batch_id=p_provider_batch_id AND impact.policy_hash=p_policy_hash)) THEN RAISE EXCEPTION 'shadow event differs from evaluation'; END IF;
  measured_at:=clock_timestamp();
  PERFORM set_config('app.swell_watch_internal_write','on',true);
  INSERT INTO public.swell_watch_shadow_demand_pairs(regional_event_id,recipient_id,first_observed_at)
    SELECT (pair->>'regional_event_id')::uuid,(pair->>'recipient_id')::uuid,measured_at FROM jsonb_array_elements(canonical) pair ON CONFLICT(regional_event_id,recipient_id) DO NOTHING;
  INSERT INTO public.swell_watch_shadow_demand_observations(provider_batch_id,policy_hash,regional_event_id,recipient_id,observed_at)
    SELECT p_provider_batch_id,p_policy_hash,(pair->>'regional_event_id')::uuid,(pair->>'recipient_id')::uuid,measured_at FROM jsonb_array_elements(canonical) pair;
  SELECT count(DISTINCT (observation.regional_event_id,observation.recipient_id)) INTO total FROM public.swell_watch_shadow_demand_observations observation WHERE observation.observed_at>measured_at-interval '24 hours' AND observation.observed_at<=measured_at;
  INSERT INTO public.swell_watch_shadow_demand_runs(provider_batch_id,policy_hash,observed_at,recipient_events,recorded_pairs_24h) VALUES(p_provider_batch_id,p_policy_hash,measured_at,canonical,total);
  RETURN QUERY SELECT measured_at,total;
END;
$$;

DO $amend$
BEGIN
  IF encode(extensions.digest(pg_get_functiondef('public.record_swell_watch_shadow_demand(uuid,text,jsonb)'::regprocedure),'sha256'),'hex') NOT IN ('a0988e626f8813aaed74e932d5850e35dde846153c9b9ee3306c778657482931','343ffc9289a607a6707bf46f4204025a1cb5fe21c8feb5e02a454b86d022c79a') THEN RAISE EXCEPTION 'shadow demand definition hash mismatch'; END IF;
END;
$amend$;

-- Reject science edits for the active current cohort only.
CREATE OR REPLACE FUNCTION public.guard_swell_watch_study_beach_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE authority public.swell_watch_study_authorities;
BEGIN
  IF OLD.lat IS NOT DISTINCT FROM NEW.lat AND OLD.lon IS NOT DISTINCT FROM NEW.lon
    AND OLD.swell_window_center_deg IS NOT DISTINCT FROM NEW.swell_window_center_deg
    AND OLD.swell_window_halfwidth_deg IS NOT DISTINCT FROM NEW.swell_window_halfwidth_deg
    AND OLD.swell_access_factors IS NOT DISTINCT FROM NEW.swell_access_factors
    AND OLD.terrain_enabled IS NOT DISTINCT FROM NEW.terrain_enabled
    AND OLD.deepwater_decay_factor IS NOT DISTINCT FROM NEW.deepwater_decay_factor
    AND OLD.shoaling_factors IS NOT DISTINCT FROM NEW.shoaling_factors THEN RETURN NEW; END IF;
  SELECT * INTO authority FROM public.swell_watch_study_authorities WHERE epoch=(SELECT max(epoch) FROM public.swell_watch_study_authorities) AND state='active' AND clock_timestamp()>=not_before AND clock_timestamp()<expires_at;
  IF FOUND AND EXISTS(SELECT 1 FROM jsonb_array_elements(authority.cohort) cohort WHERE (cohort->>'sourcePointId')::uuid=NEW.id) THEN
    RAISE EXCEPTION 'beach % is pinned by the active Swell Watch study (epoch %); change it through a reviewed study authority epoch',NEW.id,authority.epoch;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS swell_watch_study_beach_scope_guard ON public.beaches;
CREATE TRIGGER swell_watch_study_beach_scope_guard BEFORE UPDATE OF lat,lon,swell_window_center_deg,swell_window_halfwidth_deg,swell_access_factors,terrain_enabled,deepwater_decay_factor,shoaling_factors
  ON public.beaches FOR EACH ROW EXECUTE FUNCTION public.guard_swell_watch_study_beach_scope();

ALTER FUNCTION public.ingest_swell_watch_cohort(jsonb) SET lock_timeout='10s';
ALTER FUNCTION public.ingest_swell_watch_cohort(jsonb) SET statement_timeout='60s';
ALTER FUNCTION public.resolve_and_ingest_swell_watch_evaluation(uuid,uuid,uuid,uuid,text,text,timestamptz,text,numeric,numeric,numeric,numeric,text,text,text,timestamptz,timestamptz) SET lock_timeout='10s';
ALTER FUNCTION public.resolve_and_ingest_swell_watch_evaluation(uuid,uuid,uuid,uuid,text,text,timestamptz,text,numeric,numeric,numeric,numeric,text,text,text,timestamptz,timestamptz) SET statement_timeout='60s';
ALTER FUNCTION public.read_swell_watch_attested_components(uuid,uuid,timestamptz) SET lock_timeout='10s';
ALTER FUNCTION public.read_swell_watch_attested_components(uuid,uuid,timestamptz) SET statement_timeout='60s';
ALTER FUNCTION public.read_swell_watch_attested_run(uuid,uuid) SET lock_timeout='10s';
ALTER FUNCTION public.read_swell_watch_attested_run(uuid,uuid) SET statement_timeout='60s';
ALTER FUNCTION public.read_swell_watch_run_scope(uuid) SET lock_timeout='10s';
ALTER FUNCTION public.read_swell_watch_run_scope(uuid) SET statement_timeout='60s';
ALTER FUNCTION public.record_swell_watch_shadow_demand(uuid,text,jsonb) SET lock_timeout='10s';
ALTER FUNCTION public.record_swell_watch_shadow_demand(uuid,text,jsonb) SET statement_timeout='60s';
ALTER FUNCTION public.read_swell_watch_study_health() SET lock_timeout='10s';
ALTER FUNCTION public.read_swell_watch_study_health() SET statement_timeout='60s';
ALTER FUNCTION public.read_swell_watch_study_pending_runs(text) SET lock_timeout='10s';
ALTER FUNCTION public.read_swell_watch_study_pending_runs(text) SET statement_timeout='60s';
ALTER FUNCTION public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb) SET lock_timeout='10s';
ALTER FUNCTION public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb) SET statement_timeout='60s';
ALTER FUNCTION public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb) SET lock_timeout='10s';
ALTER FUNCTION public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb) SET statement_timeout='60s';
ALTER FUNCTION public.try_acquire_swell_watch_collection_lease(uuid) SET lock_timeout='10s';
ALTER FUNCTION public.try_acquire_swell_watch_collection_lease(uuid) SET statement_timeout='60s';
ALTER FUNCTION public.release_swell_watch_collection_lease(uuid) SET lock_timeout='10s';
ALTER FUNCTION public.release_swell_watch_collection_lease(uuid) SET statement_timeout='60s';
ALTER FUNCTION public.record_leased_swell_watch_provider_run_receipt(uuid,jsonb) SET lock_timeout='10s';
ALTER FUNCTION public.record_leased_swell_watch_provider_run_receipt(uuid,jsonb) SET statement_timeout='60s';
ALTER FUNCTION public.record_swell_watch_study_recovery_failure(uuid,text) SET lock_timeout='10s';
ALTER FUNCTION public.record_swell_watch_study_recovery_failure(uuid,text) SET statement_timeout='60s';

CREATE OR REPLACE FUNCTION public.read_swell_watch_provider_run_states(p_run_utcs timestamptz[])
RETURNS TABLE(run_utc timestamptz, revision_set_id uuid, completed_batch_id uuid, evaluated boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp
SET lock_timeout='10s' SET statement_timeout='60s' AS $$
DECLARE current_epoch bigint;
BEGIN
  IF p_run_utcs IS NULL OR cardinality(p_run_utcs)>8 THEN RAISE EXCEPTION 'up to 8 provider run timestamps required'; END IF;
  SELECT max(epoch) INTO current_epoch FROM public.swell_watch_study_authorities;
  RETURN QUERY
  WITH requested AS (SELECT DISTINCT value AS run_utc FROM unnest(p_run_utcs) value)
  SELECT i.run_utc, latest.id, completed.id,
    EXISTS(
      SELECT 1 FROM public.swell_watch_study_evaluations evaluation
      WHERE evaluation.provider_batch_id=completed.id AND evaluation.status='evaluated'
        AND evaluation.authority_epoch BETWEEN public.swell_watch_study_cycle_start(current_epoch) AND current_epoch
    )
  FROM requested
  JOIN public.swell_watch_provider_run_issuances i ON i.run_utc=requested.run_utc
    AND i.transport_provider='open_meteo_single_runs' AND i.model='ncep_gfswave016'
  LEFT JOIN LATERAL (
    SELECT revision_set.* FROM public.swell_watch_provider_run_revision_sets revision_set
    JOIN public.swell_watch_provider_run_batches batch ON batch.id=revision_set.batch_id
    WHERE batch.issuance_id=i.id ORDER BY revision_set.revision_number DESC LIMIT 1
  ) latest ON true
  LEFT JOIN public.swell_watch_provider_run_completed_batches completed ON completed.revision_set_id=latest.id;
END;
$$;
REVOKE ALL ON FUNCTION public.read_swell_watch_provider_run_states(timestamptz[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_swell_watch_provider_run_states(timestamptz[]) TO service_role;

REVOKE ALL ON FUNCTION public.swell_watch_study_cycle_start(bigint),public.guard_swell_watch_study_beach_scope() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.read_swell_watch_study_health(),public.read_swell_watch_study_pending_runs(text),public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb),public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_swell_watch_study_health(),public.read_swell_watch_study_pending_runs(text),public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb),public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb) TO service_role;
COMMIT;
