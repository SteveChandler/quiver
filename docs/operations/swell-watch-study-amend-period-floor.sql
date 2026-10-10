-- Evaluation policy epoch 4 + study authority epoch 8: excludes swell partitions with period < 9 s from
-- detection (partition_matching.minimum_period_s = 9). NOT APPLIED; requires Steven's approval, the
-- 20261010120000 migration and the epoch 7 tracking activation. The policy hash changes (86616945... ->
-- f5535096..., docs/operations/swell-watch-no-send-producer-config-v3-proposed.json), so swell_watch_study_cycle_start
-- starts a NEW qualifying-day cycle at epoch 8: the per-feed counter returns to 0/30. Policy and authority are
-- inserted in one transaction because read_swell_watch_study_health reports study_policy_changed otherwise.
-- After this runs, SWELL_WATCH_PRODUCER_CONFIG must carry the v3 policy or the acquire cron returns study_config_hash_mismatch.
-- Sends remain disabled. Exact retry only. Inert until the approval sentence below is filled in.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $activation$
DECLARE previous_policy public.swell_watch_evaluation_policies; latest_policy public.swell_watch_evaluation_policies;
  previous public.swell_watch_study_authorities; latest public.swell_watch_study_authorities;
  new_policy_hash text := 'f5535096a2eb18e911f22a9adf0dbd2e17b5b214c6c266e5659c3959c86eb95e';
  rule text := 'model_reported_swell_system_count.v1'; mode text := 'sub_floor_tracking.v1';
  approval text := '<<FILL AT APPROVAL: "Steven Chandler approved on YYYY-MM-DD ...">>';
  proposal text := 'Excludes swell partitions with period below 9 s (wind sea) from Swell Watch study detection by adding partition_matching.minimum_period_s=9 to the evaluation policy; the 48 h baseline, thresholds, matching tolerances, actionability window, 12h freshness and four-issuance rule are unchanged. A new policy hash starts a new qualifying-day cycle (per-feed counter returns to 0 of 30). Same cohort and expiry 2026-12-31T23:59:59Z; sends remain disabled.';
  evidence text; evidence_sha256 text; reviewer text := 'automated-study.v7 period-floor amendment under Steven Chandler authorization';
  new_values jsonb; expected_previous_hash text; expected_hash text; started_at timestamptz;
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
  IF NOT EXISTS(SELECT 1 FROM public.swell_watch_get_automation_control() c WHERE c.state='disabled') OR EXISTS(SELECT 1 FROM public.swell_watch_production_approval_authority) THEN
    RAISE EXCEPTION 'disabled sends required';
  END IF;
  SELECT * INTO previous_policy FROM public.swell_watch_evaluation_policies WHERE epoch=3;
  IF NOT FOUND OR previous_policy.state<>'active' OR previous_policy.policy_hash<>'86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f'
    OR previous_policy.expires_at<>'2026-12-31T23:59:59Z'::timestamptz OR previous_policy.policy_values #> '{partition_matching,minimum_period_s}' IS NOT NULL THEN
    RAISE EXCEPTION 'reviewed evaluation policy epoch 3 required';
  END IF;
  SELECT * INTO previous FROM public.swell_watch_study_authorities WHERE epoch=7;
  IF NOT FOUND THEN RAISE EXCEPTION 'exact reviewed epoch 7 study authority required'; END IF;
  expected_previous_hash := encode(extensions.digest(jsonb_build_object('policyHash',previous.policy_hash,'cohort',previous.cohort,'scopeInputs',previous.scope_inputs,
    'forecastDays',7,'targetDays',previous.target_days,'providerContractRef',previous.provider_contract_ref,'evidenceSha256',previous.evidence_sha256,
    'qualificationRule',previous.qualification_rule,'trackingMode',previous.tracking_mode)::text,'sha256'),'hex');
  IF previous.state<>'active' OR previous.qualification_rule<>rule OR previous.tracking_mode<>mode OR previous.config_hash<>expected_previous_hash
    OR previous.policy_hash<>previous_policy.policy_hash OR previous.target_days<>30 OR previous.scope_inputs IS DISTINCT FROM public.swell_watch_study_scope_inputs(previous.cohort)
    OR previous.expires_at<>'2026-12-31T23:59:59Z'::timestamptz THEN
    RAISE EXCEPTION 'exact reviewed epoch 7 study authority required';
  END IF;
  evidence_sha256 := encode(extensions.digest(evidence,'sha256'),'hex');
  new_values := jsonb_set(previous_policy.policy_values,'{partition_matching,minimum_period_s}','9'::jsonb);
  expected_hash := encode(extensions.digest(jsonb_build_object('policyHash',new_policy_hash,'cohort',previous.cohort,'scopeInputs',previous.scope_inputs,
    'forecastDays',7,'targetDays',previous.target_days,'providerContractRef',previous.provider_contract_ref,'evidenceSha256',evidence_sha256,
    'qualificationRule',rule,'trackingMode',mode)::text,'sha256'),'hex');
  SELECT * INTO latest_policy FROM public.swell_watch_evaluation_policies ORDER BY epoch DESC LIMIT 1;
  SELECT * INTO latest FROM public.swell_watch_study_authorities ORDER BY epoch DESC LIMIT 1;
  IF latest_policy.epoch=4 AND latest.epoch=8 AND latest_policy.state='active' AND latest_policy.policy_hash=new_policy_hash AND latest_policy.policy_values=new_values
    AND latest_policy.not_before=previous_policy.not_before AND latest_policy.expires_at=previous_policy.expires_at AND latest_policy.reviewer=reviewer
    AND latest_policy.evidence_hash=evidence_sha256
    AND latest.state='active' AND latest.policy_hash=new_policy_hash AND latest.cohort=previous.cohort AND latest.scope_inputs=previous.scope_inputs
    AND latest.config_hash=expected_hash AND latest.target_days=previous.target_days AND latest.provider_contract_ref=previous.provider_contract_ref
    AND latest.evidence_sha256=evidence_sha256 AND latest.reviewer=reviewer AND latest.qualification_rule=rule AND latest.tracking_mode=mode
    AND latest.expires_at=previous.expires_at AND latest.not_before=latest.created_at AND latest.not_before>=previous.not_before AND latest.not_before<=clock_timestamp() THEN RETURN; END IF;
  IF latest_policy.epoch<>3 OR latest.epoch<>7 OR latest.state<>'active' THEN RAISE EXCEPTION 'unexpected study authority or policy; exact amendment retry only'; END IF;
  INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
    VALUES(4,'active',new_policy_hash,new_values,reviewer,evidence_sha256,previous_policy.not_before,previous_policy.expires_at);
  started_at := clock_timestamp();
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule,tracking_mode,created_at)
  SELECT 8,'active',new_policy_hash,previous.cohort,previous.scope_inputs,expected_hash,previous.target_days,previous.provider_contract_ref,evidence_sha256,reviewer,started_at,previous.expires_at,rule,mode,started_at;
END;
$activation$;
COMMIT;
