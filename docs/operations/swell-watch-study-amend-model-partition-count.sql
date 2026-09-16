-- Reviewed epoch 4 activation. No sends; exact retry only.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $activation$
DECLARE policy public.swell_watch_evaluation_policies; previous public.swell_watch_study_authorities;
  latest public.swell_watch_study_authorities; rule text := 'model_reported_partition_count.v1';
  evidence text := encode(extensions.digest('Steven Chandler approved on 2026-09-14 reading a secondary-slot provider zero tuple with a valid primary partition as the model reporting fewer than two swell systems at that hour (NCEP SWELL:2 bitmap-missing where SWELL:1 decodes; WAVEWATCH III UNDEF for ranks beyond the found count). No synthesized values; onset and closure bounded at the adjacent native frame; same cohort, policy hash, 12h freshness, thresholds, four-issuance rule, target 30 days, expiry 2026-10-25T02:45:47.591003Z; sends remain disabled.','sha256'),'hex');
  reviewer text := 'automated-study.v3 model-reported-partition-count amendment under Steven Chandler authorization 2026-09-14'; expected_hash text; started_at timestamptz;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT * INTO policy FROM public.swell_watch_evaluation_policies ORDER BY epoch DESC LIMIT 1;
  IF NOT FOUND OR policy.epoch<>2 OR policy.state<>'active' OR policy.policy_hash<>'86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f'
    OR policy.expires_at<>'2026-10-25T02:45:47.591003Z'::timestamptz OR clock_timestamp()<policy.not_before OR clock_timestamp()>=policy.expires_at
    OR NOT EXISTS(SELECT 1 FROM public.swell_watch_get_automation_control() c WHERE c.state='disabled')
    OR EXISTS(SELECT 1 FROM public.swell_watch_production_approval_authority) THEN RAISE EXCEPTION 'reviewed active evaluation policy and disabled sends required'; END IF;
  SELECT * INTO previous FROM public.swell_watch_study_authorities WHERE epoch=3;
  IF NOT FOUND OR previous.state<>'active' OR previous.config_hash<>'bf0c71d7689394cabdb72be6fc98220dd249629a74c46356e7e408273740a91b'
    OR previous.evidence_sha256<>'fdc98be5924a9671f73791375e4bff7c8b598e08f36b5284a14bac4c74218994'
    OR previous.reviewer<>'automated-study.v2 partition-coverage amendment under Steven Chandler authorization 2026-09-14'
    OR previous.qualification_rule<>'primary_partition_with_retained_unavailable_secondary.v1' OR previous.not_before<>'2026-09-14T17:06:11.862985Z'::timestamptz
    OR previous.target_days<>30 OR previous.policy_hash<>policy.policy_hash OR previous.scope_inputs IS DISTINCT FROM public.swell_watch_study_scope_inputs(previous.cohort) THEN
    RAISE EXCEPTION 'exact reviewed epoch 3 study authority required'; END IF;
  expected_hash := encode(extensions.digest(jsonb_build_object('policyHash',previous.policy_hash,'cohort',previous.cohort,'scopeInputs',previous.scope_inputs,
    'forecastDays',7,'targetDays',previous.target_days,'providerContractRef',previous.provider_contract_ref,'evidenceSha256',evidence,'qualificationRule',rule)::text,'sha256'),'hex');
  SELECT * INTO latest FROM public.swell_watch_study_authorities ORDER BY epoch DESC LIMIT 1;
  IF latest.epoch=4 AND latest.state='active' AND latest.policy_hash=previous.policy_hash AND latest.cohort=previous.cohort AND latest.scope_inputs=previous.scope_inputs
    AND latest.target_days=previous.target_days AND latest.provider_contract_ref=previous.provider_contract_ref AND latest.expires_at=previous.expires_at
    AND latest.qualification_rule=rule AND latest.config_hash=expected_hash AND latest.evidence_sha256=evidence AND latest.reviewer=reviewer
    AND latest.not_before=latest.created_at AND latest.not_before>=previous.not_before AND latest.not_before<=clock_timestamp() THEN RETURN; END IF;
  IF latest.epoch<>3 OR latest.state<>'active' THEN RAISE EXCEPTION 'unexpected study authority; exact amendment retry only'; END IF;
  started_at := clock_timestamp();
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule,created_at)
  SELECT 4,'active',previous.policy_hash,previous.cohort,previous.scope_inputs,expected_hash,previous.target_days,previous.provider_contract_ref,evidence,reviewer,started_at,previous.expires_at,rule,started_at;
END;
$activation$;
COMMIT;
