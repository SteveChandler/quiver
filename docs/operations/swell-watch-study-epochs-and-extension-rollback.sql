-- Rollback restores the reviewed pre-amendment function definitions byte-for-byte.
-- The two new append-only recovery and shadow-observation tables remain for audit history.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL standard_conforming_strings='off';
DO $$ BEGIN IF current_user<>'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF; END $$;

DO $rollback$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.swell_watch_provider_evidence_is_current(uuid)'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex')='f59409463e431ee5485c336b113944e73fe9497563157adb2fcec75184cbffc9' THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'069ec0bf40d66182ff4ef3c6bc87550ddc2f29706b9129bfc86c720921e20345' THEN RAISE EXCEPTION 'provider evidence differs from reviewed amendment'; END IF;
  definition := $definition$CREATE OR REPLACE FUNCTION public.swell_watch_provider_evidence_is_current(p_provider_batch_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
  SELECT public.swell_watch_provider_evidence_is_current_before_study(p_provider_batch_id)
    AND NOT EXISTS(SELECT 1 FROM public.swell_watch_provider_run_completed_batches b
      JOIN public.swell_watch_study_acceptances s ON s.revision_set_id=b.revision_set_id
      JOIN public.swell_watch_study_authorities a ON a.epoch=s.authority_epoch
      WHERE b.id=p_provider_batch_id AND (
        NOT EXISTS(SELECT 1 FROM public.swell_watch_current_study_authority(a.policy_hash) c WHERE c.epoch=a.epoch)
        OR EXISTS(SELECT 1 FROM public.swell_watch_provider_run_attestations t
          WHERE t.revision_set_id=s.revision_set_id AND t.state IN ('rejected','revoked'))));
$function$ $definition$;
  EXECUTE definition;
  IF encode(extensions.digest(pg_get_functiondef('public.swell_watch_provider_evidence_is_current(uuid)'::regprocedure),'sha256'),'hex')<>'f59409463e431ee5485c336b113944e73fe9497563157adb2fcec75184cbffc9' THEN RAISE EXCEPTION 'provider evidence rollback hash mismatch'; END IF;
END;
$rollback$;

DO $rollback$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.read_swell_watch_study_health()'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex')='b2789dfdb0637335290be5883ef57f19e2889cfa071d1ecbadd6ad9b72b30c01' THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'ddbdde3a2d9f12f2972cfdf009ef6cc6b1301fd1dbd3e10270a483189abfc1f1' THEN RAISE EXCEPTION 'study health differs from reviewed amendment'; END IF;
  definition := $definition$CREATE OR REPLACE FUNCTION public.read_swell_watch_study_health()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE a public.swell_watch_study_authorities; days jsonb; policy_expiry timestamptz; health_status text; reason text; outcomes jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT * INTO a FROM public.swell_watch_study_authorities ORDER BY epoch DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unconfigured','qualifyingDays',0,'targetDays',30,
    'qualifyingDates','[]'::jsonb,'authorityEpoch',NULL,'policyHash',NULL,'reason','study_authority_missing',
    'evaluatedRuns',0,'suppressedAttempts',0,'lastEvaluatedAt',NULL,'lastSuppressedAt',NULL); END IF;
  SELECT expires_at INTO policy_expiry FROM public.swell_watch_evaluation_policies ORDER BY epoch DESC LIMIT 1;
  SELECT coalesce(jsonb_agg(day ORDER BY day),'[]'::jsonb) INTO days FROM (
    SELECT (i.run_utc AT TIME ZONE 'UTC')::date AS day
    FROM public.swell_watch_study_evaluations e
    JOIN public.swell_watch_provider_run_completed_batches b ON b.id=e.provider_batch_id
    JOIN public.swell_watch_provider_run_batches rb ON rb.id=b.batch_id
    JOIN public.swell_watch_provider_run_issuances i ON i.id=rb.issuance_id
    WHERE e.status='evaluated' AND e.policy_hash=a.policy_hash AND e.authority_epoch=a.epoch
      AND i.run_utc>=a.not_before
      AND public.swell_watch_provider_evidence_is_current_before_study(e.provider_batch_id)
      AND NOT EXISTS(SELECT 1 FROM public.swell_watch_provider_run_attestations t WHERE t.revision_set_id=b.revision_set_id
        AND t.state IN ('rejected','revoked'))
    GROUP BY (i.run_utc AT TIME ZONE 'UTC')::date HAVING count(DISTINCT i.run_utc)=4
  ) qualified;
  SELECT jsonb_build_object('evaluatedRuns',count(*) FILTER(WHERE e.status='evaluated'),
    'suppressedAttempts',count(*) FILTER(WHERE e.status='suppressed'),
    'lastEvaluatedAt',max(e.recorded_at) FILTER(WHERE e.status='evaluated'),
    'lastSuppressedAt',max(e.recorded_at) FILTER(WHERE e.status='suppressed')) INTO outcomes
    FROM public.swell_watch_study_evaluations e WHERE e.authority_epoch=a.epoch AND e.policy_hash=a.policy_hash;
  IF a.state='revoked' THEN health_status:='blocked'; reason:='study_authority_revoked';
  ELSIF NOT EXISTS(SELECT 1 FROM public.swell_watch_evaluation_policies p
    WHERE p.epoch=(SELECT max(epoch) FROM public.swell_watch_evaluation_policies)
      AND p.state='active' AND p.policy_hash=a.policy_hash) THEN health_status:='blocked'; reason:='study_policy_changed';
  ELSIF jsonb_array_length(days)>=a.target_days THEN health_status:='complete'; reason:='target_reached';
  ELSIF clock_timestamp()>=a.expires_at OR clock_timestamp()>=policy_expiry THEN health_status:='expired'; reason:='study_or_policy_expired';
  ELSIF NOT EXISTS(SELECT 1 FROM public.swell_watch_current_study_authority(a.policy_hash)) THEN
    health_status:='blocked'; reason:='study_policy_or_control_unavailable';
  ELSE health_status:='active'; reason:=NULL; END IF;
  RETURN jsonb_build_object('status',health_status,'authorityEpoch',a.epoch,'policyHash',a.policy_hash,'qualificationRule',a.qualification_rule,
    'qualifyingDays',jsonb_array_length(days),'qualifyingDates',days,'targetDays',a.target_days,'reason',reason,
    'expiresAt',least(a.expires_at,policy_expiry)) || outcomes;
END;
$function$ $definition$;
  EXECUTE definition;
  IF encode(extensions.digest(pg_get_functiondef('public.read_swell_watch_study_health()'::regprocedure),'sha256'),'hex')<>'b2789dfdb0637335290be5883ef57f19e2889cfa071d1ecbadd6ad9b72b30c01' THEN RAISE EXCEPTION 'study health rollback hash mismatch'; END IF;
END;
$rollback$;

DO $rollback$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb)'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex')='58c3a7bb5b32a0bcb3c7ab1d95678bcc93dcde2bd2763feec24ee2cffd44d85c' THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'7c4b7e0522a7d89157beda0a76b7760a0e62920ad2e7a2b7a45981da79544bfb' THEN RAISE EXCEPTION 'study completion differs from reviewed amendment'; END IF;
  definition := replace(definition,'RETURNS TABLE(provider_batch_id uuid, evaluation_id text, already_evaluated boolean, authority_epoch bigint, qualification_rule text)','RETURNS TABLE(provider_batch_id uuid, evaluation_id text, already_evaluated boolean)');
  definition := replace(definition,'; cycle_start bigint; cycle_before timestamptz;', ';');
  definition := replace(definition,E'  SELECT * INTO a FROM public.swell_watch_current_study_authority(p_policy_hash);\n  IF NOT FOUND THEN RAISE EXCEPTION ''current study config required''; END IF;\n  cycle_start := public.swell_watch_study_cycle_start(a.epoch);\n  SELECT not_before INTO cycle_before FROM public.swell_watch_study_authorities WHERE epoch=cycle_start;\n  IF a.cohort IS DISTINCT FROM p_cohort OR a.scope_inputs IS DISTINCT FROM p_scope_inputs THEN RAISE EXCEPTION ''current study config required''; END IF;\n  IF cycle_start IS NULL OR cycle_before IS NULL OR r.run_utc < cycle_before THEN RAISE EXCEPTION ''study run predates current study cycle''; END IF;',E'  SELECT * INTO a FROM public.swell_watch_current_study_authority(p_policy_hash);\n  IF NOT FOUND OR a.cohort IS DISTINCT FROM p_cohort OR a.scope_inputs IS DISTINCT FROM p_scope_inputs THEN\n    RAISE EXCEPTION ''current study config required''; END IF;');
  definition := replace(definition,'s.authority_epoch BETWEEN cycle_start AND a.epoch','s.authority_epoch=a.epoch');
  definition := replace(definition,',a.epoch,a.qualification_rule','');
  definition := replace(definition,E'\n SET lock_timeout TO ''10s''\n SET statement_timeout TO ''60s''','');
  DROP FUNCTION public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb); EXECUTE definition;
  REVOKE ALL ON FUNCTION public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb) TO service_role;
  IF encode(extensions.digest(pg_get_functiondef('public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb)'::regprocedure),'sha256'),'hex')<>'58c3a7bb5b32a0bcb3c7ab1d95678bcc93dcde2bd2763feec24ee2cffd44d85c' THEN RAISE EXCEPTION 'study completion rollback hash mismatch'; END IF;
END;
$rollback$;

DO $rollback$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.read_swell_watch_study_pending_runs(text)'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex')='bb6fd6011ad2505b6307468e95d51992993dbb9cc0fa796d10e47c4c5e3e6e39' THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex') NOT IN ('1881fb9299c3fa91f7a0b60c782439f49c026890d4344f8775778141a439e0a2','1f19ab40a3e2658739ef6a2eec144e40fcb0d33cb763f12639d6ba303287ce15') THEN RAISE EXCEPTION 'study pending differs from reviewed amendment'; END IF;
  definition := replace(definition,'; cycle_start bigint; cycle_before timestamptz;',';');
  definition := replace(definition,E'  SELECT * INTO a FROM public.swell_watch_current_study_authority(p_policy_hash);\n  IF NOT FOUND THEN RAISE EXCEPTION ''current study config required''; END IF;\n  cycle_start := public.swell_watch_study_cycle_start(a.epoch);\n  SELECT not_before INTO cycle_before FROM public.swell_watch_study_authorities WHERE epoch=cycle_start;',E'  SELECT * INTO a FROM public.swell_watch_current_study_authority(p_policy_hash);\n  IF NOT FOUND THEN RAISE EXCEPTION ''current study config required''; END IF;');
  definition := replace(definition,'i.run_utc>=greatest(clock_timestamp()-max_age,cycle_before)','i.run_utc>=clock_timestamp()-max_age');
  definition := replace(definition,E'      AND NOT EXISTS(SELECT 1 FROM public.swell_watch_study_acceptances s WHERE s.revision_set_id=rs.id AND s.authority_epoch NOT BETWEEN cycle_start AND a.epoch)\n      AND NOT EXISTS(SELECT 1 FROM public.swell_watch_study_recovery_failures failure WHERE failure.revision_set_id=rs.id\n        AND failure.failed_at > clock_timestamp()-make_interval(secs=>least(power(2,(SELECT count(*) FROM public.swell_watch_study_recovery_failures count_failure WHERE count_failure.revision_set_id=rs.id)-1),4)*3600))',E'      AND NOT EXISTS(SELECT 1 FROM public.swell_watch_study_acceptances s WHERE s.revision_set_id=rs.id AND s.authority_epoch<>a.epoch)');
  definition := replace(definition,E'\n SET lock_timeout TO ''10s''\n SET statement_timeout TO ''60s''','');
  EXECUTE definition;
  IF encode(extensions.digest(pg_get_functiondef('public.read_swell_watch_study_pending_runs(text)'::regprocedure),'sha256'),'hex')<>'bb6fd6011ad2505b6307468e95d51992993dbb9cc0fa796d10e47c4c5e3e6e39' THEN RAISE EXCEPTION 'study pending rollback hash mismatch'; END IF;
END;
$rollback$;

DROP TRIGGER IF EXISTS swell_watch_study_beach_scope_guard ON public.beaches;
DROP FUNCTION IF EXISTS public.guard_swell_watch_study_beach_scope();
DROP FUNCTION IF EXISTS public.record_swell_watch_study_recovery_failure(uuid,text);
DROP FUNCTION IF EXISTS public.swell_watch_study_cycle_start(bigint);

DO $rollback$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.record_swell_watch_shadow_demand(uuid,text,jsonb)'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex')='414be8da27827b45d94d090176c3518ca1a8759db52b21630e11290da5c23375' THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'343ffc9289a607a6707bf46f4204025a1cb5fe21c8feb5e02a454b86d022c79a' THEN RAISE EXCEPTION 'shadow demand differs from reviewed amendment'; END IF;
  definition := $definition$CREATE OR REPLACE FUNCTION public.record_swell_watch_shadow_demand(p_provider_batch_id uuid,p_policy_hash text,p_pairs jsonb)
 RETURNS TABLE(observed_at timestamptz,recorded_pairs_24h bigint)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $function$
DECLARE canonical jsonb; previous public.swell_watch_shadow_demand_runs; measured_at timestamptz; total bigint; run_at timestamptz;
BEGIN
  IF jsonb_typeof(p_pairs) IS DISTINCT FROM 'array' OR jsonb_array_length(p_pairs)>10000 THEN
    RAISE EXCEPTION 'invalid shadow demand';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_pairs) pair
    WHERE jsonb_typeof(pair) IS DISTINCT FROM 'object'
      OR pair - 'regional_event_id' - 'recipient_id' <> '{}'::jsonb
      OR coalesce(pair->>'regional_event_id','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
      OR coalesce(pair->>'recipient_id','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$') THEN
    RAISE EXCEPTION 'invalid shadow recipient/event pair';
  END IF;
  SELECT coalesce(jsonb_agg(pair ORDER BY pair->>'regional_event_id',pair->>'recipient_id'),'[]'::jsonb)
    INTO canonical FROM (SELECT DISTINCT pair FROM jsonb_array_elements(p_pairs) pair) pairs;
  IF jsonb_array_length(canonical) <> jsonb_array_length(p_pairs) THEN RAISE EXCEPTION 'duplicate shadow pair'; END IF;
  SELECT issuance.run_utc INTO run_at FROM public.swell_watch_provider_run_completed_batches completed
    JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
    JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
    WHERE completed.id=p_provider_batch_id;
  IF run_at IS NULL THEN RAISE EXCEPTION 'completed shadow provider run required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-provider-run:' ||
    to_char(run_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"'),0));
  -- ponytail: global serialization; partition only if measured collector throughput requires it.
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  IF NOT EXISTS(SELECT 1 FROM public.swell_watch_get_matching_policy() p WHERE p.policy_hash=p_policy_hash
      AND p.revoked_at IS NULL AND p.superseded_at IS NULL
      AND isfinite(p.not_before) AND isfinite(p.expires_at)
      AND clock_timestamp()>=p.not_before AND clock_timestamp()<p.expires_at)
    OR public.swell_watch_provider_evidence_is_current(p_provider_batch_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'current shadow policy and provider evidence required';
  END IF;
  SELECT * INTO previous FROM public.swell_watch_shadow_demand_runs r
    WHERE r.provider_batch_id=p_provider_batch_id AND r.policy_hash=p_policy_hash;
  IF FOUND THEN
    IF previous.recipient_events IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'shadow evaluation demand changed'; END IF;
    RETURN QUERY SELECT previous.observed_at,previous.recorded_pairs_24h;
    RETURN;
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(canonical) pair WHERE NOT EXISTS(
    SELECT 1 FROM public.swell_watch_event_impacts link
    JOIN public.swell_watch_beach_impacts impact ON impact.id=link.beach_impact_id
    JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id
    WHERE link.regional_event_id=(pair->>'regional_event_id')::uuid
      AND observation.provider_batch_id=p_provider_batch_id AND impact.policy_hash=p_policy_hash)) THEN
    RAISE EXCEPTION 'shadow event differs from evaluation';
  END IF;
  measured_at := clock_timestamp();
  PERFORM set_config('app.swell_watch_internal_write','on',true);
  INSERT INTO public.swell_watch_shadow_demand_pairs(regional_event_id,recipient_id,first_observed_at)
    SELECT (pair->>'regional_event_id')::uuid,(pair->>'recipient_id')::uuid,measured_at
    FROM jsonb_array_elements(canonical) pair
    ON CONFLICT(regional_event_id,recipient_id) DO NOTHING;
  SELECT count(*) INTO total FROM public.swell_watch_shadow_demand_pairs pair
    WHERE pair.first_observed_at>measured_at-interval '24 hours' AND pair.first_observed_at<=measured_at;
  INSERT INTO public.swell_watch_shadow_demand_runs(provider_batch_id,policy_hash,observed_at,recipient_events,recorded_pairs_24h)
    VALUES(p_provider_batch_id,p_policy_hash,measured_at,canonical,total);
  RETURN QUERY SELECT measured_at,total;
END;
$function$
$definition$;
  EXECUTE definition;
  ALTER FUNCTION public.record_swell_watch_shadow_demand(uuid,text,jsonb) RESET lock_timeout;
  ALTER FUNCTION public.record_swell_watch_shadow_demand(uuid,text,jsonb) RESET statement_timeout;
  IF encode(extensions.digest(pg_get_functiondef('public.record_swell_watch_shadow_demand(uuid,text,jsonb)'::regprocedure),'sha256'),'hex')<>'414be8da27827b45d94d090176c3518ca1a8759db52b21630e11290da5c23375' THEN RAISE EXCEPTION 'shadow demand rollback hash mismatch'; END IF;
END;
$rollback$;

DO $rollback$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex')='d1165986abe16e5c177a4d778dfa0f23ddd9d2b7407ee81c07755e39364c9f03' THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'bf9e59e110593b66364be08057b3b34a936e9ab5d01bf9311158434230c5ab3f' THEN RAISE EXCEPTION 'study recording differs from reviewed amendment'; END IF;
  definition := replace(definition,'; cycle_start bigint;',';');
  definition := replace(definition,E'  SELECT * INTO a FROM public.swell_watch_current_study_authority(p_policy_hash);\n  IF NOT FOUND THEN RAISE EXCEPTION ''current study authority and evidence required''; END IF;\n  cycle_start := public.swell_watch_study_cycle_start(a.epoch);\n  IF public.swell_watch_provider_evidence_is_current(p_provider_batch_id) IS DISTINCT FROM true\n    OR a.scope_inputs IS DISTINCT FROM p_scope_inputs\n    OR NOT EXISTS(SELECT 1 FROM public.swell_watch_provider_run_completed_batches b\n      JOIN public.swell_watch_study_acceptances s ON s.revision_set_id=b.revision_set_id\n      WHERE b.id=p_provider_batch_id AND s.authority_epoch BETWEEN cycle_start AND a.epoch) THEN',E'  SELECT * INTO a FROM public.swell_watch_current_study_authority(p_policy_hash);\n  IF NOT FOUND OR public.swell_watch_provider_evidence_is_current(p_provider_batch_id) IS DISTINCT FROM true\n    OR a.scope_inputs IS DISTINCT FROM p_scope_inputs\n    OR NOT EXISTS(SELECT 1 FROM public.swell_watch_provider_run_completed_batches b\n      JOIN public.swell_watch_study_acceptances s ON s.revision_set_id=b.revision_set_id\n      WHERE b.id=p_provider_batch_id AND s.authority_epoch=a.epoch) THEN');
  definition := replace(definition,E'\n SET lock_timeout TO ''10s''\n SET statement_timeout TO ''60s''','');
  EXECUTE definition;
  IF encode(extensions.digest(pg_get_functiondef('public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)'::regprocedure),'sha256'),'hex')<>'d1165986abe16e5c177a4d778dfa0f23ddd9d2b7407ee81c07755e39364c9f03' THEN RAISE EXCEPTION 'study recording rollback hash mismatch'; END IF;
END;
$rollback$;

DO $rollback$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.resolve_and_ingest_swell_watch_evaluation(uuid,uuid,uuid,uuid,text,text,timestamptz,text,numeric,numeric,numeric,numeric,text,text,text,timestamptz,timestamptz)'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex')='fbb618bc867533b9cfb61c2d676c2430a9d6926e04623daf5da7c8e802d9f00b' THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'767a3021f43cf63895aa6fa13ad552094983de7c99d74ff5fb4cf14c3de8fce5' THEN RAISE EXCEPTION 'study resolver differs from reviewed amendment'; END IF;
  definition := replace(definition,'; v_same_evaluation_beach boolean;',';');
  definition := replace(definition,'IF NOT v_same_evaluation_beach AND v_reference.provider=','IF v_reference.provider=');
  definition := replace(definition,E'  SELECT EXISTS(SELECT 1 FROM public.swell_watch_event_impacts association\n    JOIN public.swell_watch_beach_impacts impact ON impact.id=association.beach_impact_id\n    JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id\n    WHERE association.evaluation_id=v_evaluation AND association.beach_id=p_source_point_id\n      AND observation.provider_batch_id=p_provider_batch_id AND observation.id IS DISTINCT FROM p_observation_id) INTO v_same_evaluation_beach;\n',E'');
  definition := replace(definition,E'  ) THEN v_retry_ids := ''{}''; END IF;\n  v_matches := coalesce(v_retry_ids,''{}'');',E'  ) THEN RAISE EXCEPTION ''compatible regional identity requires current-cycle evidence''; END IF;\n  v_matches := coalesce(v_retry_ids,''{}'');');
  definition := replace(definition,'-- Aliases are an audit trail; metric matching remains the identity authority.','-- Never bypass stale/suppressed evidence or permanent dedupe by allocating a fresh ID.');
  definition := replace(definition,E'        CONTINUE;\n      END IF;',E'        RAISE EXCEPTION ''compatible regional identity requires current-cycle evidence'';\n      END IF;');
  definition := replace(definition,E'\n SET lock_timeout TO ''10s''\n SET statement_timeout TO ''60s''','');
  EXECUTE definition;
  IF encode(extensions.digest(pg_get_functiondef('public.resolve_and_ingest_swell_watch_evaluation(uuid,uuid,uuid,uuid,text,text,timestamptz,text,numeric,numeric,numeric,numeric,text,text,text,timestamptz,timestamptz)'::regprocedure),'sha256'),'hex')<>'fbb618bc867533b9cfb61c2d676c2430a9d6926e04623daf5da7c8e802d9f00b' THEN RAISE EXCEPTION 'study resolver rollback hash mismatch'; END IF;
END;
$rollback$;

DO $rollback$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.advance_swell_watch_event(uuid,text,uuid,timestamptz,timestamptz,uuid)'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex')='30884e1bf78ebd1d35f4c36f30b7b93ef622d76d71d14a25cc9d445f6d5c9d18' THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'78bca1572d81dfb07d7e6112514f698f5079b613c08cc8f715b9f5803db027d4' THEN RAISE EXCEPTION 'event advance differs from reviewed amendment'; END IF;
  definition := replace(definition,'\n  v_required integer; v_current_count integer; v_latest_stable_evaluation_id text;','');
  definition := replace(definition,E'  IF v_latest_state = ''stable'' THEN\n    SELECT trigger_evaluation_id INTO v_latest_stable_evaluation_id FROM public.swell_watch_event_state_transitions WHERE regional_event_id=p_regional_event_id ORDER BY version DESC LIMIT 1;\n    IF EXISTS(SELECT 1 FROM public.swell_watch_event_evaluations evaluation\n      JOIN public.swell_watch_beach_impacts impact ON impact.id=evaluation.beach_impact_id\n      JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id\n      WHERE evaluation.regional_event_id=p_regional_event_id AND evaluation.evaluation_id=v_latest_stable_evaluation_id\n        AND public.swell_watch_provider_evidence_is_current(observation.provider_batch_id)) THEN RETURN ''stable''; END IF;\n  END IF;',E'  IF v_latest_state = ''stable'' THEN\n    RETURN ''stable'';\n  END IF;');
  definition := replace(definition,E'  SELECT (policy_values #>> ''{stability,minimum_genuine_evaluations}'')::integer INTO v_required FROM public.swell_watch_get_matching_policy();\n  SELECT count(DISTINCT evaluation.evaluation_id) INTO v_current_count\n  FROM public.swell_watch_event_evaluations evaluation\n  JOIN public.swell_watch_beach_impacts impact ON impact.id=evaluation.beach_impact_id\n  JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id\n  WHERE evaluation.regional_event_id=p_regional_event_id AND evaluation.identity_kind=''genuine_completed''\n    AND public.swell_watch_provider_evidence_is_current(observation.provider_batch_id);\n  IF coalesce(v_current_count,0) < greatest(coalesce(v_required,2),2) THEN RETURN ''candidate''; END IF;',E'  IF v_count < 2 THEN RETURN ''candidate''; END IF;');
  definition := replace(definition,E'\n SET lock_timeout TO ''10s''\n SET statement_timeout TO ''60s''','');
  EXECUTE definition;
  IF encode(extensions.digest(pg_get_functiondef('public.advance_swell_watch_event(uuid,text,uuid,timestamptz,timestamptz,uuid)'::regprocedure),'sha256'),'hex')<>'30884e1bf78ebd1d35f4c36f30b7b93ef622d76d71d14a25cc9d445f6d5c9d18' THEN RAISE EXCEPTION 'event advance rollback hash mismatch'; END IF;
END;
$rollback$;

ALTER FUNCTION public.ingest_swell_watch_cohort(jsonb) RESET lock_timeout; ALTER FUNCTION public.ingest_swell_watch_cohort(jsonb) RESET statement_timeout;
ALTER FUNCTION public.resolve_and_ingest_swell_watch_evaluation(uuid,uuid,uuid,uuid,text,text,timestamptz,text,numeric,numeric,numeric,numeric,text,text,text,timestamptz,timestamptz) RESET lock_timeout; ALTER FUNCTION public.resolve_and_ingest_swell_watch_evaluation(uuid,uuid,uuid,uuid,text,text,timestamptz,text,numeric,numeric,numeric,numeric,text,text,text,timestamptz,timestamptz) RESET statement_timeout;
ALTER FUNCTION public.read_swell_watch_attested_components(uuid,uuid,timestamptz) RESET lock_timeout; ALTER FUNCTION public.read_swell_watch_attested_components(uuid,uuid,timestamptz) RESET statement_timeout;
ALTER FUNCTION public.read_swell_watch_attested_run(uuid,uuid) RESET lock_timeout; ALTER FUNCTION public.read_swell_watch_attested_run(uuid,uuid) RESET statement_timeout;
ALTER FUNCTION public.read_swell_watch_run_scope(uuid) RESET lock_timeout; ALTER FUNCTION public.read_swell_watch_run_scope(uuid) RESET statement_timeout;
ALTER FUNCTION public.record_swell_watch_shadow_demand(uuid,text,jsonb) RESET lock_timeout; ALTER FUNCTION public.record_swell_watch_shadow_demand(uuid,text,jsonb) RESET statement_timeout;
ALTER FUNCTION public.read_swell_watch_study_health() RESET lock_timeout; ALTER FUNCTION public.read_swell_watch_study_health() RESET statement_timeout;
ALTER FUNCTION public.read_swell_watch_study_pending_runs(text) RESET lock_timeout; ALTER FUNCTION public.read_swell_watch_study_pending_runs(text) RESET statement_timeout;
ALTER FUNCTION public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb) RESET lock_timeout; ALTER FUNCTION public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb) RESET statement_timeout;
ALTER FUNCTION public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb) RESET lock_timeout; ALTER FUNCTION public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb) RESET statement_timeout;
ALTER FUNCTION public.try_acquire_swell_watch_collection_lease(uuid) RESET lock_timeout; ALTER FUNCTION public.try_acquire_swell_watch_collection_lease(uuid) RESET statement_timeout;
ALTER FUNCTION public.release_swell_watch_collection_lease(uuid) RESET lock_timeout; ALTER FUNCTION public.release_swell_watch_collection_lease(uuid) RESET statement_timeout;
ALTER FUNCTION public.record_leased_swell_watch_provider_run_receipt(uuid,jsonb) RESET lock_timeout; ALTER FUNCTION public.record_leased_swell_watch_provider_run_receipt(uuid,jsonb) RESET statement_timeout;
DROP FUNCTION IF EXISTS public.read_swell_watch_provider_run_states(timestamptz[]);
COMMIT;
