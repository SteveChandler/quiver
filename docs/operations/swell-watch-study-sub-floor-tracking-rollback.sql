-- Restores the three study functions changed by 20261010120000_add_swell_watch_study_sub_floor_tracking.sql.
-- Revoke any tracking epoch first; the tracking_mode column is retained (default 'none', inert).
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  IF EXISTS(SELECT 1 FROM public.swell_watch_study_authorities a WHERE a.epoch=(SELECT max(epoch) FROM public.swell_watch_study_authorities)
    AND a.state='active' AND a.tracking_mode<>'none') THEN
    RAISE EXCEPTION 'revoke the active tracking authority before rolling back';
  END IF;
END $$;

-- guard_swell_watch_study_authority: post fc2486d6e78c083df6f961bbd0a57e00ab41610fa1d5e34246be46809c48a891; restored pre 0746463f7308dc48acce42a70dfe3c01dc72e0ac97f6540e294d80dd16d808e8.
DO $rollback$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.guard_swell_watch_study_authority()'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex')='0746463f7308dc48acce42a70dfe3c01dc72e0ac97f6540e294d80dd16d808e8' THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'fc2486d6e78c083df6f961bbd0a57e00ab41610fa1d5e34246be46809c48a891' THEN
    RAISE EXCEPTION 'guard_swell_watch_study_authority differs from the reviewed tracking definition';
  END IF;
  definition := $definition$CREATE OR REPLACE FUNCTION public.guard_swell_watch_study_authority()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE canonical jsonb;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'study authority is append only'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  IF NEW.epoch<>coalesce((SELECT max(epoch) FROM public.swell_watch_study_authorities),0)+1 THEN
    RAISE EXCEPTION 'study authority epoch must advance by one';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.cohort) s WHERE
    jsonb_typeof(s) IS DISTINCT FROM 'object' OR s-'sourcePointId'-'regionKey'<>'{}'::jsonb
    OR coalesce(s->>'sourcePointId','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    OR jsonb_typeof(s->'regionKey') IS DISTINCT FROM 'string'
    OR char_length(btrim(s->>'regionKey')) NOT BETWEEN 1 AND 100
    OR s->>'regionKey' IS DISTINCT FROM btrim(s->>'regionKey'))
    OR (SELECT count(DISTINCT s->>'sourcePointId') FROM jsonb_array_elements(NEW.cohort) s)<>10 THEN
    RAISE EXCEPTION 'invalid study cohort';
  END IF;
  SELECT jsonb_agg(s ORDER BY s->>'sourcePointId') INTO canonical FROM jsonb_array_elements(NEW.cohort) s;
  IF NEW.state='active' THEN
    PERFORM 1 FROM public.beaches b WHERE b.id IN (SELECT (s->>'sourcePointId')::uuid FROM jsonb_array_elements(NEW.cohort) s)
      ORDER BY b.id FOR SHARE;
    IF NEW.scope_inputs IS DISTINCT FROM public.swell_watch_study_scope_inputs(NEW.cohort) THEN
      RAISE EXCEPTION 'study scope inputs differ from current beaches';
    END IF;
  END IF;
  IF canonical IS DISTINCT FROM NEW.cohort OR NEW.config_hash IS DISTINCT FROM
    encode(extensions.digest((jsonb_build_object('policyHash',NEW.policy_hash,'cohort',NEW.cohort,'scopeInputs',NEW.scope_inputs,
      'forecastDays',7,'targetDays',NEW.target_days,'providerContractRef',NEW.provider_contract_ref,'evidenceSha256',NEW.evidence_sha256) || CASE WHEN NEW.qualification_rule='complete_partitions.v1' THEN '{}'::jsonb
      ELSE jsonb_build_object('qualificationRule',NEW.qualification_rule) END)::text,'sha256'),'hex') THEN
    RAISE EXCEPTION 'study config hash or cohort ordering mismatch';
  END IF;
  RETURN NEW;
END;
$function$

$definition$;
  EXECUTE definition;
  IF encode(extensions.digest(pg_get_functiondef('public.guard_swell_watch_study_authority()'::regprocedure),'sha256'),'hex')<>'0746463f7308dc48acce42a70dfe3c01dc72e0ac97f6540e294d80dd16d808e8' THEN
    RAISE EXCEPTION 'guard_swell_watch_study_authority rollback hash mismatch';
  END IF;
END;
$rollback$;

-- read_swell_watch_study_health: post b48d69a9ffb135ce9116b519bc63daeed07e736b689d4cfead1460f7b4ad70f5; restored pre db17c16e2c3af8f092f34f8cb7feacd6f23e55984d96b7731ffaf16d2ab9d1b2.
DO $rollback$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.read_swell_watch_study_health()'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex')='db17c16e2c3af8f092f34f8cb7feacd6f23e55984d96b7731ffaf16d2ab9d1b2' THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'b48d69a9ffb135ce9116b519bc63daeed07e736b689d4cfead1460f7b4ad70f5' THEN
    RAISE EXCEPTION 'read_swell_watch_study_health differs from the reviewed tracking definition';
  END IF;
  definition := $definition$CREATE OR REPLACE FUNCTION public.read_swell_watch_study_health()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET lock_timeout TO '10s'
 SET statement_timeout TO '60s'
AS $function$
DECLARE a public.swell_watch_study_authorities; start_epoch bigint; cycle_before timestamptz;
  feed_days jsonb; days jsonb; best_days integer; policy_expiry timestamptz;
  health_status text; reason text; outcomes jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT * INTO a FROM public.swell_watch_study_authorities ORDER BY epoch DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unconfigured','qualifyingDays',0,'targetDays',30,
    'qualifyingDates','[]'::jsonb,'qualifyingDaysByFeed','{}'::jsonb,'qualificationBasis','best_completed_feed',
    'authorityEpoch',NULL,'policyHash',NULL,'qualificationRule',NULL,'cycleStartEpoch',NULL,'cycleNotBefore',NULL,
    'reason','study_authority_missing','evaluatedRuns',0,'suppressedAttempts',0,
    'lastEvaluatedAt',NULL,'lastSuppressedAt',NULL); END IF;
  start_epoch := public.swell_watch_study_cycle_start(a.epoch);
  SELECT not_before INTO cycle_before FROM public.swell_watch_study_authorities WHERE epoch=start_epoch;
  SELECT expires_at INTO policy_expiry FROM public.swell_watch_evaluation_policies ORDER BY epoch DESC LIMIT 1;
  SELECT jsonb_object_agg(feed, jsonb_build_object('qualifyingDays',jsonb_array_length(dates),'qualifyingDates',dates))
    INTO feed_days FROM (
    SELECT scope->>'sourcePointId' AS feed, coalesce((
      SELECT jsonb_agg(day ORDER BY day) FROM (
        SELECT (i.run_utc AT TIME ZONE 'UTC')::date AS day
        FROM public.swell_watch_study_evaluations e
        JOIN public.swell_watch_provider_run_completed_batches b ON b.id=e.provider_batch_id
        JOIN public.swell_watch_provider_run_batches rb ON rb.id=b.batch_id
        JOIN public.swell_watch_provider_run_issuances i ON i.id=rb.issuance_id
        WHERE e.status='evaluated' AND e.policy_hash=a.policy_hash
          AND e.authority_epoch BETWEEN start_epoch AND a.epoch AND i.run_utc>=cycle_before
          AND public.swell_watch_provider_evidence_is_current_before_study(e.provider_batch_id)
          AND EXISTS(SELECT 1 FROM jsonb_array_elements(e.result->'scopeOutcomes') outcome
            WHERE outcome->>'sourcePointId'=scope->>'sourcePointId' AND outcome->>'status'='derived')
        GROUP BY (i.run_utc AT TIME ZONE 'UTC')::date HAVING count(DISTINCT i.run_utc)=4
      ) qualified), '[]'::jsonb) AS dates
    FROM jsonb_array_elements(a.cohort) scope
  ) feeds;
  SELECT (value->>'qualifyingDays')::integer, value->'qualifyingDates'
    INTO best_days, days FROM jsonb_each(feed_days)
    ORDER BY (value->>'qualifyingDays')::integer DESC, key LIMIT 1;
  best_days := coalesce(best_days,0);
  days := coalesce(days,'[]'::jsonb);
  SELECT jsonb_build_object('evaluatedRuns',count(*) FILTER(WHERE e.status='evaluated'),
    'suppressedAttempts',count(*) FILTER(WHERE e.status='suppressed'),
    'lastEvaluatedAt',max(e.recorded_at) FILTER(WHERE e.status='evaluated'),
    'lastSuppressedAt',max(e.recorded_at) FILTER(WHERE e.status='suppressed')) INTO outcomes
    FROM public.swell_watch_study_evaluations e WHERE e.authority_epoch BETWEEN start_epoch AND a.epoch AND e.policy_hash=a.policy_hash;
  IF a.state='revoked' THEN health_status:='blocked'; reason:='study_authority_revoked';
  ELSIF NOT EXISTS(SELECT 1 FROM public.swell_watch_evaluation_policies p WHERE p.epoch=(SELECT max(epoch) FROM public.swell_watch_evaluation_policies) AND p.state='active' AND p.policy_hash=a.policy_hash) THEN health_status:='blocked'; reason:='study_policy_changed';
  ELSIF best_days>=a.target_days THEN health_status:='complete'; reason:='target_reached';
  ELSIF clock_timestamp()>=a.expires_at OR clock_timestamp()>=policy_expiry THEN health_status:='expired'; reason:='study_or_policy_expired';
  ELSIF NOT EXISTS(SELECT 1 FROM public.swell_watch_current_study_authority(a.policy_hash)) THEN health_status:='blocked'; reason:='study_policy_or_control_unavailable';
  ELSE health_status:='active'; reason:=NULL; END IF;
  RETURN jsonb_build_object('status',health_status,'authorityEpoch',a.epoch,'policyHash',a.policy_hash,'qualificationRule',a.qualification_rule,
    'cycleStartEpoch',start_epoch,'cycleNotBefore',cycle_before,'qualifyingDays',best_days,
    'qualifyingDates',days,'qualifyingDaysByFeed',feed_days,'qualificationBasis','best_completed_feed',
    'targetDays',a.target_days,'reason',reason,'expiresAt',least(a.expires_at,policy_expiry)) || outcomes;
END;
$function$

$definition$;
  EXECUTE definition;
  IF encode(extensions.digest(pg_get_functiondef('public.read_swell_watch_study_health()'::regprocedure),'sha256'),'hex')<>'db17c16e2c3af8f092f34f8cb7feacd6f23e55984d96b7731ffaf16d2ab9d1b2' THEN
    RAISE EXCEPTION 'read_swell_watch_study_health rollback hash mismatch';
  END IF;
END;
$rollback$;

-- record_swell_watch_study_evaluation: post 99e5cbded55cd87b91f36bca9f3b007464f2cc0cb7f8b70fa51f646f47d60d4c; restored pre 9c0671783aa5ee045c89107c8910d6e0f649072cb932f5544e5196b7cdb2071c.
DO $rollback$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex')='9c0671783aa5ee045c89107c8910d6e0f649072cb932f5544e5196b7cdb2071c' THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'99e5cbded55cd87b91f36bca9f3b007464f2cc0cb7f8b70fa51f646f47d60d4c' THEN
    RAISE EXCEPTION 'record_swell_watch_study_evaluation differs from the reviewed tracking definition';
  END IF;
  definition := $definition$CREATE OR REPLACE FUNCTION public.record_swell_watch_study_evaluation(p_provider_batch_id uuid, p_policy_hash text, p_result jsonb, p_scope_inputs jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET lock_timeout TO '10s'
 SET statement_timeout TO '60s'
AS $function$
DECLARE a public.swell_watch_study_authorities; run_at timestamptz; measured_at timestamptz; digest text; demand public.swell_watch_shadow_demand_runs; raw_batch uuid; scope jsonb; slot text; observed numeric; unavailable numeric; absent numeric; stored_zero_tuples bigint; stored_invalid_absent bigint; cycle_start bigint;
BEGIN
  SELECT i.run_utc,b.batch_id INTO run_at,raw_batch FROM public.swell_watch_provider_run_completed_batches b
    JOIN public.swell_watch_provider_run_batches rb ON rb.id=b.batch_id
    JOIN public.swell_watch_provider_run_issuances i ON i.id=rb.issuance_id WHERE b.id=p_provider_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'completed study run required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-provider-run:' ||
    to_char(run_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"'),0));
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  PERFORM 1 FROM public.beaches b WHERE b.id IN (SELECT (s->>'sourcePointId')::uuid FROM jsonb_array_elements(p_scope_inputs) s)
    ORDER BY b.id FOR SHARE;
  SELECT * INTO a FROM public.swell_watch_current_study_authority(p_policy_hash);
  IF NOT FOUND THEN RAISE EXCEPTION 'current study authority and evidence required'; END IF;
  cycle_start := public.swell_watch_study_cycle_start(a.epoch);
  IF public.swell_watch_provider_evidence_is_current(p_provider_batch_id) IS DISTINCT FROM true
    OR a.scope_inputs IS DISTINCT FROM p_scope_inputs
    OR NOT EXISTS(SELECT 1 FROM public.swell_watch_provider_run_completed_batches b
      JOIN public.swell_watch_study_acceptances s ON s.revision_set_id=b.revision_set_id
      WHERE b.id=p_provider_batch_id AND s.authority_epoch BETWEEN cycle_start AND a.epoch) THEN
    RAISE EXCEPTION 'current study authority and evidence required';
  END IF;
  IF jsonb_typeof(p_result) IS DISTINCT FROM 'object' OR octet_length(p_result::text)>131072
    OR p_result->>'providerBatchId' IS DISTINCT FROM p_provider_batch_id::text
    OR p_result->>'policyHash' IS DISTINCT FROM p_policy_hash
    OR coalesce(p_result->>'status','') NOT IN ('evaluated','suppressed')
    OR p_result->'enqueued' IS DISTINCT FROM '0'::jsonb
    OR p_result->>'sendEligibility' IS DISTINCT FROM 'not_evaluated'
    OR jsonb_typeof(p_result->'scopeOutcomes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid study result'; END IF;
  IF jsonb_array_length(p_result->'scopeOutcomes')<>10
    OR (SELECT count(DISTINCT s->>'sourcePointId') FROM jsonb_array_elements(p_result->'scopeOutcomes') s)<>10
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_result->'scopeOutcomes') s WHERE
      jsonb_typeof(s) IS DISTINCT FROM 'object' OR s-'sourcePointId'-'status'-'reason'<>'{}'::jsonb
      OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a.cohort) c WHERE c->>'sourcePointId'=s->>'sourcePointId')
      OR coalesce(s->>'status','') NOT IN ('derived','suppressed')
      OR (s->>'status'='derived' AND s->'reason' IS DISTINCT FROM 'null'::jsonb)
      OR (s->>'status'='suppressed' AND (jsonb_typeof(s->'reason') IS DISTINCT FROM 'string'
        OR char_length(btrim(s->>'reason')) NOT BETWEEN 1 AND 500))) THEN RAISE EXCEPTION 'invalid study scope outcomes'; END IF;
  IF p_result->'derivation' IS NULL OR p_result->'derivation'='null'::jsonb THEN
    IF p_result->>'status'<>'suppressed' THEN RAISE EXCEPTION 'evaluated study derivation required'; END IF;
  ELSE
    IF jsonb_typeof(p_result->'derivation') IS DISTINCT FROM 'object'
      OR p_result->'derivation'->>'qualificationRule' IS DISTINCT FROM a.qualification_rule THEN
      RAISE EXCEPTION 'study qualification rule differs from authority';
    END IF;
    IF jsonb_typeof(p_result #> '{derivation,scopes}') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'invalid study derivation scopes';
    END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(p_result #> '{derivation,scopes}')) <>
      (SELECT count(*) FROM jsonb_array_elements(p_result->'scopeOutcomes') s WHERE s->>'status'='derived')
      OR (SELECT count(DISTINCT s->>'sourcePointId') FROM jsonb_array_elements(p_result #> '{derivation,scopes}') s) <>
        jsonb_array_length(p_result #> '{derivation,scopes}') THEN RAISE EXCEPTION 'invalid study derivation scopes'; END IF;
    FOR scope IN SELECT * FROM jsonb_array_elements(p_result #> '{derivation,scopes}') LOOP
      IF jsonb_typeof(scope) IS DISTINCT FROM 'object' OR NOT EXISTS(
        SELECT 1 FROM jsonb_array_elements(p_result->'scopeOutcomes') s
        WHERE s->>'sourcePointId'=scope->>'sourcePointId' AND s->>'status'='derived') THEN
        RAISE EXCEPTION 'invalid study derivation scopes';
      END IF;
      FOREACH slot IN ARRAY ARRAY['s1','s2'] LOOP
        IF jsonb_typeof(scope #> ARRAY['partitionCoverage',slot,'observed']) IS DISTINCT FROM 'number'
          OR jsonb_typeof(scope #> ARRAY['partitionCoverage',slot,'unavailable']) IS DISTINCT FROM 'number'
          OR (scope #> ARRAY['partitionCoverage',slot,'absent'] IS NOT NULL
            AND jsonb_typeof(scope #> ARRAY['partitionCoverage',slot,'absent']) IS DISTINCT FROM 'number') THEN
          RAISE EXCEPTION 'invalid study partition coverage';
        END IF;
        observed := (scope #>> ARRAY['partitionCoverage',slot,'observed'])::numeric;
        unavailable := (scope #>> ARRAY['partitionCoverage',slot,'unavailable'])::numeric;
        absent := coalesce((scope #>> ARRAY['partitionCoverage',slot,'absent'])::numeric,0);
        IF observed<0 OR unavailable<0 OR absent<0 OR trunc(observed)<>observed OR trunc(unavailable)<>unavailable OR trunc(absent)<>absent
          OR observed+unavailable+absent<>168 OR (slot='s1' AND unavailable<>0) THEN
          RAISE EXCEPTION 'invalid study partition coverage';
        END IF;
        SELECT count(*) FILTER (WHERE c.unavailable_reason IS NOT NULL AND c.source_slot=slot) INTO stored_zero_tuples
          FROM public.swell_watch_provider_run_completed_batches b
          JOIN public.swell_watch_provider_run_revision_set_members m ON m.revision_set_id=b.revision_set_id
          JOIN public.swell_watch_provider_run_batch_scopes s ON s.id=m.scope_id AND s.batch_id=b.batch_id
          JOIN public.swell_watch_provider_run_revision_components c ON c.revision_id=m.revision_id
          WHERE b.id=p_provider_batch_id AND s.source_point_id::text=scope->>'sourcePointId';
        IF slot='s1' AND a.qualification_rule<>'model_reported_swell_system_count.v1' AND stored_zero_tuples<>0 THEN RAISE EXCEPTION 'study partition coverage differs from retained components'; END IF;
        IF a.qualification_rule='model_reported_swell_system_count.v1' AND absent IS DISTINCT FROM stored_zero_tuples THEN RAISE EXCEPTION 'study partition coverage differs from retained components'; END IF;
        IF slot='s2' AND ((a.qualification_rule='complete_partitions.v1' AND p_result->>'status'='evaluated' AND (unavailable<>0 OR absent<>0))
          OR (a.qualification_rule='primary_partition_with_retained_unavailable_secondary.v1' AND (unavailable IS DISTINCT FROM stored_zero_tuples OR absent<>0))
          OR (a.qualification_rule='model_reported_partition_count.v1' AND (absent IS DISTINCT FROM stored_zero_tuples OR unavailable<>0))
          OR (a.qualification_rule='model_reported_swell_system_count.v1' AND (absent IS DISTINCT FROM stored_zero_tuples OR unavailable<>0))) THEN
          RAISE EXCEPTION 'study partition coverage differs from retained components';
        END IF;
      END LOOP;
      IF a.qualification_rule='model_reported_partition_count.v1' THEN
        SELECT count(*) INTO stored_invalid_absent
        FROM public.swell_watch_provider_run_completed_batches b
        JOIN public.swell_watch_provider_run_revision_set_members m ON m.revision_set_id=b.revision_set_id
        JOIN public.swell_watch_provider_run_batch_scopes s ON s.id=m.scope_id AND s.batch_id=b.batch_id
        JOIN public.swell_watch_provider_run_revision_components secondary ON secondary.revision_id=m.revision_id
        LEFT JOIN public.swell_watch_provider_run_revision_components primary_component ON primary_component.revision_id=m.revision_id
          AND primary_component.source_slot='s1' AND primary_component.forecast_at=secondary.forecast_at
        WHERE b.id=p_provider_batch_id AND s.source_point_id::text=scope->>'sourcePointId'
          AND secondary.source_slot='s2' AND secondary.unavailable_reason IS NOT NULL
          AND (primary_component.unavailable_reason IS NOT NULL OR primary_component.revision_id IS NULL);
        IF stored_invalid_absent<>0 THEN RAISE EXCEPTION 'absent partition requires a valid primary partition'; END IF;
      END IF;
    END LOOP;
  END IF;
    IF a.qualification_rule='model_reported_swell_system_count.v1' AND EXISTS(SELECT 1 FROM public.swell_watch_provider_run_completed_batches b
      JOIN public.swell_watch_provider_run_revision_set_members m ON m.revision_set_id=b.revision_set_id
      JOIN public.swell_watch_provider_run_batch_scopes s ON s.id=m.scope_id AND s.batch_id=b.batch_id
      JOIN public.swell_watch_provider_run_revision_components primary_component ON primary_component.revision_id=m.revision_id
      LEFT JOIN public.swell_watch_provider_run_revision_components secondary_component ON secondary_component.revision_id=m.revision_id AND secondary_component.source_slot='s2' AND secondary_component.forecast_at=primary_component.forecast_at
      WHERE b.id=p_provider_batch_id AND s.source_point_id::text=scope->>'sourcePointId' AND primary_component.source_slot='s1' AND primary_component.unavailable_reason IS NOT NULL
        AND (secondary_component.unavailable_reason IS NULL OR secondary_component.revision_id IS NULL)) THEN
      RAISE EXCEPTION 'absent primary partition requires absent secondary partition';
    END IF;
  digest := encode(extensions.digest(p_result::text,'sha256'),'hex');
  IF EXISTS(SELECT 1 FROM public.swell_watch_study_evaluations e WHERE e.provider_batch_id=p_provider_batch_id
    AND e.policy_hash=p_policy_hash AND e.result_hash=digest) THEN RETURN '{"recorded":true}'::jsonb; END IF;
  IF EXISTS(SELECT 1 FROM public.swell_watch_study_evaluations e WHERE e.provider_batch_id=p_provider_batch_id
    AND e.policy_hash=p_policy_hash AND e.status='evaluated') THEN RAISE EXCEPTION 'successful study result is immutable'; END IF;
  measured_at := clock_timestamp();
  IF p_result->>'status'='evaluated' THEN
    IF p_result->'evaluationIds' IS DISTINCT FROM jsonb_build_array('genuine_completed:'||raw_batch)
      OR EXISTS(SELECT 1 FROM unnest(ARRAY['candidateCount','stableRegionalEventCount','preSafetyRecipientsThisEvaluation']) field
        WHERE CASE WHEN jsonb_typeof(p_result->field)='number' THEN
          (p_result->>field)::numeric<0 OR (p_result->>field)::numeric>9007199254740991
          OR trunc((p_result->>field)::numeric)<>(p_result->>field)::numeric ELSE true END)
      OR jsonb_typeof(p_result->'suppressionReasons') IS DISTINCT FROM 'object'
      OR jsonb_typeof(p_result->'safety') IS DISTINCT FROM 'object'
      OR p_result->'projectedSendsRolling24Hours' IS DISTINCT FROM 'null'::jsonb
      OR p_result->'deliveryHealth' IS DISTINCT FROM 'null'::jsonb THEN
      RAISE EXCEPTION 'complete successful study result required';
    END IF;
    IF EXISTS(SELECT 1 FROM jsonb_each(p_result->'suppressionReasons') reason
      WHERE char_length(btrim(reason.key)) NOT BETWEEN 1 AND 200 OR CASE WHEN jsonb_typeof(reason.value)='number' THEN
        (reason.value::text)::numeric<0 OR (reason.value::text)::numeric>9007199254740991
        OR trunc((reason.value::text)::numeric)<>(reason.value::text)::numeric ELSE true END)
      OR (p_result->'safety')-'reasonCode'-'missingMetrics'<>'{}'::jsonb
      OR p_result #> '{safety,missingMetrics}' IS DISTINCT FROM '["projected_send_window","delivery_health"]'::jsonb
      OR NOT ((p_result #> '{safety,reasonCode}')='null'::jsonb OR
        (p_result #>> '{safety,reasonCode}')=ANY(ARRAY['invalid_hold_input','authority_invalid','candidate_cap_exceeded',
          'recipient_cap_exceeded','projected_send_cap_exceeded','data_discontinuity','material_disagreement','forecast_stale','provider_failure_rate']))
      OR NOT (p_result->'safety' ? 'reasonCode') THEN RAISE EXCEPTION 'invalid study safety or suppression counters'; END IF;
    SELECT * INTO demand FROM public.swell_watch_shadow_demand_runs d WHERE d.provider_batch_id=p_provider_batch_id AND d.policy_hash=p_policy_hash;
    IF NOT FOUND OR p_result->'reason' IS DISTINCT FROM 'null'::jsonb
      OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_result->'scopeOutcomes') s WHERE s->>'status'='derived')
      OR jsonb_typeof(p_result #> '{recordedDemand,observedAt}') IS DISTINCT FROM 'string'
      OR jsonb_typeof(p_result #> '{recordedDemand,recipientEventPairs24Hours}') IS DISTINCT FROM 'number'
      OR p_result #>> '{recordedDemand,observedAt}' IS NULL
      OR (p_result #>> '{recordedDemand,observedAt}')::timestamptz IS DISTINCT FROM demand.observed_at
      OR (p_result #>> '{recordedDemand,recipientEventPairs24Hours}')::bigint IS DISTINCT FROM demand.recorded_pairs_24h
      OR measured_at<run_at OR measured_at>run_at+make_interval(secs=>(SELECT
        (p.policy_values #>> '{staleness,maximum_forecast_age_hours}')::double precision*3600
        FROM public.swell_watch_evaluation_policies p ORDER BY p.epoch DESC LIMIT 1)) THEN
      RAISE EXCEPTION 'fresh evaluated study demand and complete outcomes required';
    END IF;
  ELSIF jsonb_typeof(p_result->'reason') IS DISTINCT FROM 'string' OR char_length(btrim(p_result->>'reason')) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'suppression reason required';
  END IF;
  PERFORM set_config('app.swell_watch_internal_write','on',true);
  INSERT INTO public.swell_watch_study_evaluations(provider_batch_id,authority_epoch,policy_hash,result,result_hash,status,recorded_at)
    VALUES(p_provider_batch_id,a.epoch,p_policy_hash,p_result,digest,p_result->>'status',measured_at);
  RETURN '{"recorded":true}'::jsonb;
END;
$function$

$definition$;
  EXECUTE definition;
  IF encode(extensions.digest(pg_get_functiondef('public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)'::regprocedure),'sha256'),'hex')<>'9c0671783aa5ee045c89107c8910d6e0f649072cb932f5544e5196b7cdb2071c' THEN
    RAISE EXCEPTION 'record_swell_watch_study_evaluation rollback hash mismatch';
  END IF;
END;
$rollback$;

COMMIT;
