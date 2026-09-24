-- Count complete no-send samples per feed. Historical derivation-only suppressions remain diagnostic.
-- Rollback: restore read_swell_watch_study_health and record_swell_watch_study_evaluation
-- from 20260918180000_harden_swell_watch_study_epochs_and_extend.sql.
BEGIN;

DO $amend$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex') NOT IN
    ('783c4973bb51591f7629ae1ec67729390adc33f4405910ffc8c39f1cffa1337d',
     'bf9e59e110593b66364be08057b3b34a936e9ab5d01bf9311158434230c5ab3f') THEN
    RAISE EXCEPTION 'study recording definition differs from reviewed baseline';
  END IF;
  IF position('OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_result->''scopeOutcomes'') s WHERE s->>''status''<>''derived'')' IN definition)=0 THEN
    RAISE EXCEPTION 'study recording guard missing';
  END IF;
  definition := replace(definition,
    'OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_result->''scopeOutcomes'') s WHERE s->>''status''<>''derived'')',
    'OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_result->''scopeOutcomes'') s WHERE s->>''status''=''derived'')');
  EXECUTE definition;
END;
$amend$;

DO $amend$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.read_swell_watch_study_health()'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex') NOT IN
    ('f21df04b9d6bc609590f0ab9124b849a46710493e58fa4ba71f1f8d8fcd27dc8',
     'a58dc043ec7df36533ed6955ae7584fe4aed81ec89fa6acb345bff0031fea563') THEN
    RAISE EXCEPTION 'study health definition differs from reviewed baseline';
  END IF;
END;
$amend$;

CREATE OR REPLACE FUNCTION public.read_swell_watch_study_health()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.swell_watch_study_authorities; start_epoch bigint; cycle_before timestamptz;
  feed_days jsonb; days jsonb; minimum_days integer; policy_expiry timestamptz;
  health_status text; reason text; outcomes jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT * INTO a FROM public.swell_watch_study_authorities ORDER BY epoch DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unconfigured','qualifyingDays',0,'targetDays',30,
    'qualifyingDates','[]'::jsonb,'qualifyingDaysByFeed','{}'::jsonb,'qualificationBasis','minimum_completed_feed',
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
    INTO minimum_days, days FROM jsonb_each(feed_days)
    ORDER BY (value->>'qualifyingDays')::integer, key LIMIT 1;
  minimum_days := coalesce(minimum_days,0);
  days := coalesce(days,'[]'::jsonb);
  SELECT jsonb_build_object('evaluatedRuns',count(*) FILTER(WHERE e.status='evaluated'),
    'suppressedAttempts',count(*) FILTER(WHERE e.status='suppressed'),
    'lastEvaluatedAt',max(e.recorded_at) FILTER(WHERE e.status='evaluated'),
    'lastSuppressedAt',max(e.recorded_at) FILTER(WHERE e.status='suppressed')) INTO outcomes
    FROM public.swell_watch_study_evaluations e WHERE e.authority_epoch BETWEEN start_epoch AND a.epoch AND e.policy_hash=a.policy_hash;
  IF a.state='revoked' THEN health_status:='blocked'; reason:='study_authority_revoked';
  ELSIF NOT EXISTS(SELECT 1 FROM public.swell_watch_evaluation_policies p WHERE p.epoch=(SELECT max(epoch) FROM public.swell_watch_evaluation_policies) AND p.state='active' AND p.policy_hash=a.policy_hash) THEN health_status:='blocked'; reason:='study_policy_changed';
  ELSIF minimum_days>=a.target_days THEN health_status:='complete'; reason:='target_reached';
  ELSIF clock_timestamp()>=a.expires_at OR clock_timestamp()>=policy_expiry THEN health_status:='expired'; reason:='study_or_policy_expired';
  ELSIF NOT EXISTS(SELECT 1 FROM public.swell_watch_current_study_authority(a.policy_hash)) THEN health_status:='blocked'; reason:='study_policy_or_control_unavailable';
  ELSE health_status:='active'; reason:=NULL; END IF;
  RETURN jsonb_build_object('status',health_status,'authorityEpoch',a.epoch,'policyHash',a.policy_hash,'qualificationRule',a.qualification_rule,
    'cycleStartEpoch',start_epoch,'cycleNotBefore',cycle_before,'qualifyingDays',minimum_days,
    'qualifyingDates',days,'qualifyingDaysByFeed',feed_days,'qualificationBasis','minimum_completed_feed',
    'targetDays',a.target_days,'reason',reason,'expiresAt',least(a.expires_at,policy_expiry)) || outcomes;
END;
$$;

ALTER FUNCTION public.read_swell_watch_study_health() SET lock_timeout='10s';
ALTER FUNCTION public.read_swell_watch_study_health() SET statement_timeout='60s';
REVOKE ALL ON FUNCTION public.read_swell_watch_study_health() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_swell_watch_study_health() TO service_role;
COMMIT;
