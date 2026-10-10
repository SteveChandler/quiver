-- Epoch 7 activation: sub-floor tracking only. NOT APPLIED; requires Steven's approval and the
-- 20261010120000 migration. Same policy hash, cohort, qualification rule, thresholds and expiry as epoch 6,
-- so the qualifying-day cycle continues (swell_watch_study_cycle_start does not compare tracking_mode).
-- Sends remain disabled. Exact retry only. Inert until the approval sentence below is filled in.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $activation$
DECLARE policy public.swell_watch_evaluation_policies; previous public.swell_watch_study_authorities; latest public.swell_watch_study_authorities;
  rule text := 'model_reported_swell_system_count.v1'; mode text := 'sub_floor_tracking.v1';
  approval text := '<<FILL AT APPROVAL: "Steven Chandler approved on YYYY-MM-DD ...">>';
  proposal text := 'Adds non-evaluative sub-floor tracking: while a swell already persisted or detectable is below the minimum_days_before_arrival floor, its updated arrival, peak, height and period are retained as top-level trackingEvents of the study result. Tracking rows are never evaluations, candidates, qualifying-day inputs, stability counts or sends. Same cohort, policy hash, rule, thresholds, 12h freshness, four-issuance rule, target 30 days, expiry 2026-12-31T23:59:59Z; sends remain disabled.';
  evidence text; evidence_sha256 text; reviewer text := 'automated-study.v6 sub-floor tracking amendment under Steven Chandler authorization'; expected_previous_hash text; expected_hash text; started_at timestamptz;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  evidence := approval || ' ' || proposal;
  IF position('<<' IN evidence) > 0 THEN RAISE EXCEPTION 'approval evidence not recorded; this script is inert until Steven approves'; END IF;
  IF encode(extensions.digest(pg_get_functiondef('public.guard_swell_watch_study_authority()'::regprocedure),'sha256'),'hex')<>'fc2486d6e78c083df6f961bbd0a57e00ab41610fa1d5e34246be46809c48a891'
    OR encode(extensions.digest(pg_get_functiondef('public.read_swell_watch_study_health()'::regprocedure),'sha256'),'hex')<>'b48d69a9ffb135ce9116b519bc63daeed07e736b689d4cfead1460f7b4ad70f5'
    OR encode(extensions.digest(pg_get_functiondef('public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)'::regprocedure),'sha256'),'hex')<>'99e5cbded55cd87b91f36bca9f3b007464f2cc0cb7f8b70fa51f646f47d60d4c'
    OR encode(extensions.digest(pg_get_functiondef('public.swell_watch_study_cycle_start(bigint)'::regprocedure),'sha256'),'hex')<>'9fdc723c2a458b8f43ba82e758299428d4b9701d9826ae0324c32f466be5cb2e'
    OR encode(extensions.digest(pg_get_functiondef('public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb)'::regprocedure),'sha256'),'hex')<>'7c4b7e0522a7d89157beda0a76b7760a0e62920ad2e7a2b7a45981da79544bfb' THEN
    RAISE EXCEPTION 'reviewed sub-floor tracking migration required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT * INTO policy FROM public.swell_watch_evaluation_policies ORDER BY epoch DESC LIMIT 1;
  IF NOT FOUND OR policy.epoch<>3 OR policy.state<>'active' OR policy.policy_hash<>'86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f'
    OR policy.expires_at<>'2026-12-31T23:59:59Z'::timestamptz OR clock_timestamp()<policy.not_before OR clock_timestamp()>=policy.expires_at
    OR NOT EXISTS(SELECT 1 FROM public.swell_watch_get_automation_control() c WHERE c.state='disabled') OR EXISTS(SELECT 1 FROM public.swell_watch_production_approval_authority) THEN
    RAISE EXCEPTION 'reviewed active evaluation policy and disabled sends required';
  END IF;
  SELECT * INTO previous FROM public.swell_watch_study_authorities WHERE epoch=6;
  IF NOT FOUND THEN RAISE EXCEPTION 'exact reviewed epoch 6 study authority required'; END IF;
  expected_previous_hash := encode(extensions.digest(jsonb_build_object('policyHash',previous.policy_hash,'cohort',previous.cohort,'scopeInputs',previous.scope_inputs,
    'forecastDays',7,'targetDays',previous.target_days,'providerContractRef',previous.provider_contract_ref,'evidenceSha256',previous.evidence_sha256,'qualificationRule',previous.qualification_rule)::text,'sha256'),'hex');
  IF previous.state<>'active' OR previous.qualification_rule<>rule OR previous.tracking_mode<>'none' OR previous.config_hash<>expected_previous_hash
    OR previous.policy_hash<>policy.policy_hash OR previous.target_days<>30 OR previous.scope_inputs IS DISTINCT FROM public.swell_watch_study_scope_inputs(previous.cohort)
    OR previous.reviewer<>'automated-study.v5 extension under Steven Chandler authorization 2026-09-18'
    OR previous.not_before<>'2026-09-19T01:31:16.191501Z'::timestamptz OR previous.expires_at<>'2026-12-31T23:59:59Z'::timestamptz THEN
    RAISE EXCEPTION 'exact reviewed epoch 6 study authority required';
  END IF;
  evidence_sha256 := encode(extensions.digest(evidence,'sha256'),'hex');
  expected_hash := encode(extensions.digest(jsonb_build_object('policyHash',previous.policy_hash,'cohort',previous.cohort,'scopeInputs',previous.scope_inputs,
    'forecastDays',7,'targetDays',previous.target_days,'providerContractRef',previous.provider_contract_ref,'evidenceSha256',evidence_sha256,'qualificationRule',rule,'trackingMode',mode)::text,'sha256'),'hex');
  SELECT * INTO latest FROM public.swell_watch_study_authorities ORDER BY epoch DESC LIMIT 1;
  IF latest.epoch=7 AND latest.state='active' AND latest.policy_hash=previous.policy_hash AND latest.cohort=previous.cohort AND latest.scope_inputs=previous.scope_inputs
    AND latest.config_hash=expected_hash AND latest.target_days=previous.target_days AND latest.provider_contract_ref=previous.provider_contract_ref
    AND latest.evidence_sha256=evidence_sha256 AND latest.reviewer=reviewer AND latest.qualification_rule=rule AND latest.tracking_mode=mode
    AND latest.expires_at=previous.expires_at AND latest.not_before=latest.created_at AND latest.not_before>=previous.not_before AND latest.not_before<=clock_timestamp() THEN RETURN; END IF;
  IF latest.epoch<>6 OR latest.state<>'active' THEN RAISE EXCEPTION 'unexpected study authority; exact amendment retry only'; END IF;
  started_at := clock_timestamp();
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule,tracking_mode,created_at)
  SELECT 7,'active',previous.policy_hash,previous.cohort,previous.scope_inputs,expected_hash,previous.target_days,previous.provider_contract_ref,evidence_sha256,reviewer,started_at,previous.expires_at,rule,mode,started_at;
END;
$activation$;
COMMIT;
