-- Reviewed no-send extension through 2026-12-31. Exact retry only; sends remain disabled.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $activation$
DECLARE policy public.swell_watch_evaluation_policies; previous public.swell_watch_study_authorities; latest public.swell_watch_study_authorities; latest_policy public.swell_watch_evaluation_policies;
  rule text := 'model_reported_swell_system_count.v1';
  evidence text := 'Steven Chandler approved on 2026-09-16 reading a forecast hour whose primary and secondary swell partitions are both provider zero tuples as the model reporting zero swell systems at that hour (WAVEWATCH III UNDEF for all swell ranks when only wind sea is found; Open-Meteo zero-fills that UNDEF). Extends the 2026-09-14 model-reported-partition-count interpretation; no synthesized values; open episodes close at the adjacent native frame; same cohort, policy hash, 12h freshness, thresholds, four-issuance rule, target 30 days, expiry 2026-10-25T02:45:47.591003Z; sends remain disabled.';
  approval text := 'Steven Chandler approved on 2026-09-18 extending the no-send Swell Watch study and its evaluation policy to 2026-12-31T23:59:59Z with identical policy values, cohort, qualification rule, thresholds, 12h freshness, four-issuance rule and target 30 days; sends remain disabled.';
  evidence_sha256 text; expected_epoch5_hash text; expected_epoch6_hash text; reviewer text := 'automated-study.v5 extension under Steven Chandler authorization 2026-09-18'; started_at timestamptz;
BEGIN
  IF current_user<>'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  IF encode(extensions.digest(pg_get_functiondef('public.swell_watch_provider_evidence_is_current(uuid)'::regprocedure),'sha256'),'hex')<>'069ec0bf40d66182ff4ef3c6bc87550ddc2f29706b9129bfc86c720921e20345'
    OR encode(extensions.digest(pg_get_functiondef('public.read_swell_watch_study_health()'::regprocedure),'sha256'),'hex')<>'ddbdde3a2d9f12f2972cfdf009ef6cc6b1301fd1dbd3e10270a483189abfc1f1'
    OR encode(extensions.digest(pg_get_functiondef('public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb)'::regprocedure),'sha256'),'hex')<>'7c4b7e0522a7d89157beda0a76b7760a0e62920ad2e7a2b7a45981da79544bfb'
    OR encode(extensions.digest(pg_get_functiondef('public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)'::regprocedure),'sha256'),'hex')<>'bf9e59e110593b66364be08057b3b34a936e9ab5d01bf9311158434230c5ab3f'
    OR encode(extensions.digest(pg_get_functiondef('public.read_swell_watch_study_pending_runs(text)'::regprocedure),'sha256'),'hex')<>'27e2b3446f4d1b95db0ea832631cf8d10ecadc1b9bc9e672da4b8c2103917629'
    OR encode(extensions.digest(pg_get_functiondef('public.resolve_and_ingest_swell_watch_evaluation(uuid,uuid,uuid,uuid,text,text,timestamptz,text,numeric,numeric,numeric,numeric,text,text,text,timestamptz,timestamptz)'::regprocedure),'sha256'),'hex')<>'767a3021f43cf63895aa6fa13ad552094983de7c99d74ff5fb4cf14c3de8fce5'
    OR encode(extensions.digest(pg_get_functiondef('public.advance_swell_watch_event(uuid,text,uuid,timestamptz,timestamptz,uuid)'::regprocedure),'sha256'),'hex')<>'78bca1572d81dfb07d7e6112514f698f5079b613c08cc8f715b9f5803db027d4'
    OR encode(extensions.digest(pg_get_functiondef('public.record_swell_watch_shadow_demand(uuid,text,jsonb)'::regprocedure),'sha256'),'hex')<>'6cdc9bf3e3605571dfe82040a91aad49ad02124c9bee8fc41908124cfac87f47' THEN
    RAISE EXCEPTION 'reviewed Swell Watch hardening migration required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  evidence_sha256 := encode(extensions.digest(evidence,'sha256'),'hex');
  SELECT * INTO policy FROM public.swell_watch_evaluation_policies WHERE epoch=2;
  IF NOT FOUND OR policy.state<>'active' OR policy.policy_hash<>'86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f'
    OR policy.expires_at<>'2026-10-25T02:45:47.591003Z'::timestamptz OR clock_timestamp()<policy.not_before OR clock_timestamp()>=policy.expires_at
    OR NOT EXISTS(SELECT 1 FROM public.swell_watch_get_automation_control() c WHERE c.state='disabled')
    OR EXISTS(SELECT 1 FROM public.swell_watch_production_approval_authority) THEN RAISE EXCEPTION 'reviewed active evaluation policy and disabled sends required'; END IF;
  SELECT * INTO previous FROM public.swell_watch_study_authorities WHERE epoch=5;
  IF NOT FOUND THEN RAISE EXCEPTION 'exact reviewed epoch 5 study authority required'; END IF;
  expected_epoch5_hash := encode(extensions.digest(jsonb_build_object('policyHash',previous.policy_hash,'cohort',previous.cohort,'scopeInputs',previous.scope_inputs,
    'forecastDays',7,'targetDays',previous.target_days,'providerContractRef',previous.provider_contract_ref,'evidenceSha256',previous.evidence_sha256,'qualificationRule',previous.qualification_rule)::text,'sha256'),'hex');
  IF previous.state<>'active' OR previous.qualification_rule<>rule OR previous.config_hash<>expected_epoch5_hash OR previous.evidence_sha256<>evidence_sha256
    OR previous.policy_hash<>policy.policy_hash OR previous.scope_inputs IS DISTINCT FROM public.swell_watch_study_scope_inputs(previous.cohort)
    OR previous.expires_at<>'2026-10-25T02:45:47.591003Z'::timestamptz THEN RAISE EXCEPTION 'exact reviewed epoch 5 study authority required'; END IF;
  SELECT * INTO latest_policy FROM public.swell_watch_evaluation_policies ORDER BY epoch DESC LIMIT 1;
  IF latest_policy.epoch=3 AND latest_policy.state='active' AND latest_policy.policy_hash=policy.policy_hash AND latest_policy.policy_values=policy.policy_values
    AND latest_policy.not_before=policy.not_before AND latest_policy.expires_at='2026-12-31T23:59:59Z'::timestamptz
    AND latest_policy.reviewer='Steven Chandler (study extension 2026-09-18)' AND latest_policy.evidence_hash=encode(extensions.digest(approval,'sha256'),'hex') THEN NULL;
  ELSIF latest_policy.epoch<>2 THEN RAISE EXCEPTION 'unexpected evaluation policy; exact extension retry only';
  ELSE
    INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
      SELECT 3,'active',policy_hash,policy_values,'Steven Chandler (study extension 2026-09-18)',encode(extensions.digest(approval,'sha256'),'hex'),not_before,'2026-12-31T23:59:59Z'::timestamptz FROM public.swell_watch_evaluation_policies WHERE epoch=2;
  END IF;
  expected_epoch6_hash := encode(extensions.digest(jsonb_build_object('policyHash',previous.policy_hash,'cohort',previous.cohort,'scopeInputs',previous.scope_inputs,
    'forecastDays',7,'targetDays',previous.target_days,'providerContractRef',previous.provider_contract_ref,'evidenceSha256',previous.evidence_sha256,'qualificationRule',rule)::text,'sha256'),'hex');
  IF expected_epoch6_hash<>previous.config_hash THEN RAISE EXCEPTION 'exact reviewed epoch 6 config hash required'; END IF;
  SELECT * INTO latest FROM public.swell_watch_study_authorities ORDER BY epoch DESC LIMIT 1;
  IF latest.epoch=7 THEN RAISE EXCEPTION 'unexpected study authority; exact extension retry only'; END IF;
  IF latest.epoch=6 AND latest.state='active' AND latest.policy_hash=previous.policy_hash AND latest.cohort=previous.cohort AND latest.scope_inputs=previous.scope_inputs
    AND latest.config_hash=expected_epoch6_hash AND latest.target_days=previous.target_days AND latest.provider_contract_ref=previous.provider_contract_ref
    AND latest.qualification_rule=rule AND latest.evidence_sha256=previous.evidence_sha256 AND latest.reviewer=reviewer
    AND latest.expires_at='2026-12-31T23:59:59Z'::timestamptz AND latest.not_before=latest.created_at AND latest.not_before>=previous.not_before AND latest.not_before<=clock_timestamp() THEN RETURN; END IF;
  IF latest.epoch<>5 OR latest.state<>'active' THEN RAISE EXCEPTION 'unexpected study authority; exact extension retry only'; END IF;
  started_at:=clock_timestamp();
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule,created_at)
    SELECT 6,'active',previous.policy_hash,previous.cohort,previous.scope_inputs,expected_epoch6_hash,previous.target_days,previous.provider_contract_ref,previous.evidence_sha256,reviewer,started_at,'2026-12-31T23:59:59Z'::timestamptz,rule,started_at;
END;
$activation$;
COMMIT;
