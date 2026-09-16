-- Epoch 5 activation. No sends; exact retry only.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $activation$
DECLARE policy public.swell_watch_evaluation_policies; previous public.swell_watch_study_authorities; latest public.swell_watch_study_authorities;
  rule text := 'model_reported_swell_system_count.v1'; evidence text := 'Steven Chandler approved on 2026-09-16 reading a forecast hour whose primary and secondary swell partitions are both provider zero tuples as the model reporting zero swell systems at that hour (WAVEWATCH III UNDEF for all swell ranks when only wind sea is found; Open-Meteo zero-fills that UNDEF). Extends the 2026-09-14 model-reported-partition-count interpretation; no synthesized values; open episodes close at the adjacent native frame; same cohort, policy hash, 12h freshness, thresholds, four-issuance rule, target 30 days, expiry 2026-10-25T02:45:47.591003Z; sends remain disabled.'; evidence_sha256 text; reviewer text := 'automated-study.v4 model-reported-swell-system-count amendment under Steven Chandler authorization 2026-09-16'; expected_hash text; started_at timestamptz;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT * INTO policy FROM public.swell_watch_evaluation_policies ORDER BY epoch DESC LIMIT 1;
  IF NOT FOUND OR policy.epoch<>2 OR policy.state<>'active' OR policy.policy_hash<>'86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f'
    OR policy.expires_at<>'2026-10-25T02:45:47.591003Z'::timestamptz OR clock_timestamp()<policy.not_before OR clock_timestamp()>=policy.expires_at
    OR NOT EXISTS(SELECT 1 FROM public.swell_watch_get_automation_control() c WHERE c.state='disabled') OR EXISTS(SELECT 1 FROM public.swell_watch_production_approval_authority) THEN RAISE EXCEPTION 'reviewed active evaluation policy and disabled sends required'; END IF;
  SELECT * INTO previous FROM public.swell_watch_study_authorities WHERE epoch=4;
  IF NOT FOUND OR previous.state<>'active' OR previous.config_hash<>'6f7efd19f2b9086d3b0c1982e5d8fc3e6e6d4715b8d918863636198f59e399a9'
    OR previous.evidence_sha256<>'4db6916ef046df290c778626fde27fc232aa3a1744e61a3bb0c18c49344d5916' OR previous.reviewer<>'automated-study.v3 model-reported-partition-count amendment under Steven Chandler authorization 2026-09-14'
    OR previous.qualification_rule<>'model_reported_partition_count.v1' OR previous.not_before<>'2026-09-14T19:55:52.959651Z'::timestamptz OR previous.target_days<>30 OR previous.policy_hash<>policy.policy_hash
    OR previous.expires_at<>'2026-10-25T02:45:47.591003Z'::timestamptz OR previous.scope_inputs IS DISTINCT FROM public.swell_watch_study_scope_inputs(previous.cohort) THEN RAISE EXCEPTION 'exact reviewed epoch 4 study authority required'; END IF;
  evidence_sha256 := encode(extensions.digest(evidence,'sha256'),'hex');
  expected_hash := encode(extensions.digest(jsonb_build_object('policyHash',previous.policy_hash,'cohort',previous.cohort,'scopeInputs',public.swell_watch_study_scope_inputs(previous.cohort),'forecastDays',7,'targetDays',previous.target_days,'providerContractRef',previous.provider_contract_ref,'evidenceSha256',evidence_sha256,'qualificationRule',rule)::text,'sha256'),'hex');
  SELECT * INTO latest FROM public.swell_watch_study_authorities ORDER BY epoch DESC LIMIT 1;
  IF latest.epoch=5 AND latest.state='active' AND latest.policy_hash=previous.policy_hash AND latest.cohort=previous.cohort AND latest.scope_inputs=previous.scope_inputs AND latest.config_hash=expected_hash
    AND latest.target_days=previous.target_days AND latest.provider_contract_ref=previous.provider_contract_ref AND latest.evidence_sha256=evidence_sha256 AND latest.reviewer=reviewer AND latest.qualification_rule=rule
    AND latest.expires_at=previous.expires_at AND latest.not_before=latest.created_at AND latest.not_before>=previous.not_before AND latest.not_before<=clock_timestamp() THEN RETURN; END IF;
  IF latest.epoch<>4 OR latest.state<>'active' THEN RAISE EXCEPTION 'unexpected study authority; exact amendment retry only'; END IF;
  started_at := clock_timestamp();
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule,created_at)
  SELECT 5,'active',previous.policy_hash,previous.cohort,previous.scope_inputs,expected_hash,previous.target_days,previous.provider_contract_ref,evidence_sha256,reviewer,started_at,previous.expires_at,rule,started_at;
END;
$activation$;
COMMIT;
