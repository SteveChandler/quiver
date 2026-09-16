-- Reviewed Option 2: new no-send study epoch, no reinterpretation of prior results.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $activation$
DECLARE
  policy public.swell_watch_evaluation_policies;
  previous public.swell_watch_study_authorities;
  latest public.swell_watch_study_authorities;
  rule text := 'primary_partition_with_retained_unavailable_secondary.v1';
  evidence text := encode(extensions.digest('Steven Chandler approved option 2 on 2026-09-14: a source with a fully observed primary swell partition qualifies when its secondary partition is retained as provider_zero_tuple (unavailable) on some hours; unavailable hours are not tracked, every actionable event must be completely observed, and no absence is inferred. Same cohort, policy hash, 12h freshness, thresholds, four-issuance rule, target 30 days, expiry 2026-10-25T02:45:47.591003Z; sends remain disabled.','sha256'),'hex');
  reviewer text := 'automated-study.v2 partition-coverage amendment under Steven Chandler authorization 2026-09-14';
  expected_hash text;
  started_at timestamptz;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT * INTO policy FROM public.swell_watch_evaluation_policies ORDER BY epoch DESC LIMIT 1;
  IF NOT FOUND OR policy.epoch<>2 OR policy.state<>'active'
    OR policy.policy_hash<>'86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f'
    OR policy.expires_at<>'2026-10-25T02:45:47.591003Z'::timestamptz
    OR clock_timestamp()<policy.not_before OR clock_timestamp()>=policy.expires_at
    OR NOT EXISTS(SELECT 1 FROM public.swell_watch_get_automation_control() c WHERE c.state='disabled')
    OR EXISTS(SELECT 1 FROM public.swell_watch_production_approval_authority) THEN
    RAISE EXCEPTION 'reviewed active evaluation policy and disabled sends required';
  END IF;
  SELECT * INTO previous FROM public.swell_watch_study_authorities WHERE epoch=2;
  IF NOT FOUND OR previous.epoch<>2 OR previous.state<>'active'
    OR previous.config_hash<>'7390521c13f45cb5a1ce9a0cbe7a53d092a2e05ff187e5f2b773b75df74b3d7e'
    OR previous.evidence_sha256<>'d2733c02f8903601e140a51a7a7e0d5a89c3f6d54b63988960c35420bb2d216b'
    OR previous.reviewer<>'automated-study.v1 under Steven Chandler standing authorization'
    OR previous.target_days<>30 OR previous.qualification_rule<>'complete_partitions.v1'
    OR previous.provider_contract_ref<>'automated-study.v1: pinned Open-Meteo Single Runs requests; validated raw and semantic receipts; response does not echo issuance; no-send study only'
    OR previous.policy_hash<>'86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f'
    OR previous.expires_at<>'2026-10-25T02:45:47.591003Z'::timestamptz
    OR previous.scope_inputs IS DISTINCT FROM public.swell_watch_study_scope_inputs(previous.cohort) THEN
    RAISE EXCEPTION 'exact reviewed epoch 2 study authority required';
  END IF;
  expected_hash := encode(extensions.digest(jsonb_build_object('policyHash',previous.policy_hash,'cohort',previous.cohort,'scopeInputs',previous.scope_inputs,
    'forecastDays',7,'targetDays',previous.target_days,'providerContractRef',previous.provider_contract_ref,
    'evidenceSha256',evidence,'qualificationRule',rule)::text,'sha256'),'hex');
  SELECT * INTO latest FROM public.swell_watch_study_authorities ORDER BY epoch DESC LIMIT 1;
  IF latest.epoch=3 AND latest.state='active' AND latest.qualification_rule=rule
    AND latest.policy_hash=previous.policy_hash AND latest.cohort=previous.cohort AND latest.scope_inputs=previous.scope_inputs
    AND latest.target_days=previous.target_days AND latest.provider_contract_ref=previous.provider_contract_ref
    AND latest.expires_at=previous.expires_at AND latest.config_hash=expected_hash
    AND latest.evidence_sha256=evidence AND latest.reviewer=reviewer
    AND latest.not_before=latest.created_at AND latest.not_before>=previous.not_before
    AND latest.not_before<=clock_timestamp() THEN RETURN; END IF;
  IF latest.epoch<>2 OR latest.state<>'active' THEN RAISE EXCEPTION 'unexpected study authority; exact amendment retry only'; END IF;
  started_at := clock_timestamp();
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,
    provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule,created_at)
  SELECT 3,'active',previous.policy_hash,previous.cohort,previous.scope_inputs,expected_hash,previous.target_days,
    previous.provider_contract_ref,evidence,reviewer,started_at,previous.expires_at,rule,started_at
  WHERE NOT EXISTS(SELECT 1 FROM public.swell_watch_study_authorities WHERE epoch=3);
END;
$activation$;
COMMIT;
