-- Epoch 7 activation: no-send detector v3 (2.0 energy gate, trailing-frame baseline, partition-ramp timing).
-- Exact retry only; sends remain disabled. A new policy hash starts a new study cycle: epoch 5/6 days do not carry over.
-- Prerequisite: migration 20261004150000_add_swell_watch_trailing_baseline_read.sql applied.
-- Policy hash ee9bb5cf5a8e0181cad42510e6a8f4469f5ec9d5701387baebeedbe39df01a39 is calculateSwellWatchPolicyHash of docs/operations/swell-watch-no-send-producer-config-v3-proposed.json.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $activation$
DECLARE
  old_policy public.swell_watch_evaluation_policies; latest_policy public.swell_watch_evaluation_policies;
  previous public.swell_watch_study_authorities; latest public.swell_watch_study_authorities;
  rule text := 'model_reported_swell_system_count.v1';
  new_hash text := 'ee9bb5cf5a8e0181cad42510e6a8f4469f5ec9d5701387baebeedbe39df01a39';
  new_values jsonb := $values${
  "actionability": {
    "maximum_days_before_arrival": 5,
    "minimum_days_before_arrival": 2
  },
  "cadence": {
    "evaluation_interval_minutes": 60
  },
  "detection": {
    "baseline": {
      "maximum_lead_hours": 12,
      "minimum_trailing_frames": 36,
      "source": "trailing_persisted_frames.v1",
      "trailing_hours": 48
    },
    "timing": {
      "actionability_basis": "ramp_arrival",
      "arrival_rise_fraction": 0.5,
      "source": "partition_ramp.v1"
    }
  },
  "local_impact": {
    "minimum_impact_score": 1
  },
  "local_significance": {
    "minimum_energy_ratio": 2,
    "minimum_height_rise_ft": 1
  },
  "missing_or_disagreement": {
    "suppress_on_material_source_disagreement": true,
    "suppress_on_missing_partition": true
  },
  "partition_matching": {
    "maximum_arrival_delta_hours": 6,
    "maximum_direction_delta_deg": 25,
    "maximum_period_delta_s": 2,
    "trajectory_assignment": "max-cardinality-minimax-normalized.v1"
  },
  "provider_failure_hold": {
    "maximum_failure_rate": 0.05,
    "minimum_samples": 20,
    "window_minutes": 60
  },
  "stability": {
    "minimum_genuine_evaluations": 2
  },
  "staleness": {
    "maximum_forecast_age_hours": 12
  },
  "volume_caps": {
    "maximum_candidates_per_region": 50,
    "maximum_projected_sends_per_window": 1000,
    "maximum_recipients_per_event": 1000,
    "projected_send_window_hours": 24
  }
}
$values$::jsonb;
  approval text := 'Steven Chandler approved on 2026-10-04 the Swell Watch epoch 7 detector: minimum energy ratio 2.0 (1 ft rise and 1 ft face floors unchanged); baseline taken from the persisted model frames for the 48 hours before issuance (36 of 48 hourly frames required, otherwise missing_baseline); reported arrival and peak taken from the full contiguous ramp of the tracked partition (peak at maximum projected face height, arrival at half of the peak rise) with the 2-5 day actionability test applied to that arrival. Same cohort, scope inputs, qualification rule, matching tolerances, 12h freshness, four-issuance rule and target of 30 days; expiry 2026-12-31T23:59:59Z; sends remain disabled; this starts a new study cycle.';
  reviewer text := 'automated-study.v6 detector epoch 7 under Steven Chandler authorization 2026-10-04';
  policy_reviewer text := 'Steven Chandler (detector epoch 7 2026-10-04)';
  evidence_sha256 text; expected_hash text; started_at timestamptz;
BEGIN
  IF current_user<>'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  IF to_regprocedure('public.read_swell_watch_trailing_baseline(uuid,uuid,integer,integer)') IS NULL
    OR encode(extensions.digest(pg_get_functiondef(to_regprocedure('public.read_swell_watch_trailing_baseline(uuid,uuid,integer,integer)')),'sha256'),'hex')<>'71926421638a5e0bed67c833dc950d462637ae8d675454b4e94191dc01789a10'
    OR NOT has_function_privilege('service_role','public.read_swell_watch_trailing_baseline(uuid,uuid,integer,integer)','EXECUTE')
    OR has_function_privilege('anon','public.read_swell_watch_trailing_baseline(uuid,uuid,integer,integer)','EXECUTE')
    OR has_function_privilege('authenticated','public.read_swell_watch_trailing_baseline(uuid,uuid,integer,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'reviewed trailing baseline migration required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  IF NOT EXISTS(SELECT 1 FROM public.swell_watch_get_automation_control() c WHERE c.state='disabled')
    OR EXISTS(SELECT 1 FROM public.swell_watch_production_approval_authority) THEN RAISE EXCEPTION 'disabled sends required'; END IF;
  evidence_sha256 := encode(extensions.digest(approval,'sha256'),'hex');
  SELECT * INTO old_policy FROM public.swell_watch_evaluation_policies WHERE epoch=3;
  IF NOT FOUND OR old_policy.state<>'active' OR old_policy.policy_hash<>'86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f'
    OR old_policy.evidence_hash<>'ae96b46ba9491d20eea6d285c22791efc670aa8e414bdedd284ec954ecae8cec'
    OR old_policy.expires_at<>'2026-12-31T23:59:59Z'::timestamptz
    OR old_policy.policy_values IS DISTINCT FROM (SELECT p.policy_values FROM public.swell_watch_evaluation_policies p WHERE p.epoch=2) THEN
    RAISE EXCEPTION 'reviewed epoch 3 evaluation policy required';
  END IF;
  SELECT * INTO previous FROM public.swell_watch_study_authorities WHERE epoch=6;
  IF NOT FOUND OR previous.state<>'active' OR previous.policy_hash<>old_policy.policy_hash OR previous.qualification_rule<>rule
    OR previous.target_days<>30 OR previous.expires_at<>'2026-12-31T23:59:59Z'::timestamptz
    OR previous.reviewer<>'automated-study.v5 extension under Steven Chandler authorization 2026-09-18'
    OR previous.evidence_sha256<>'57af09901b522edabcff159d8b45605cf90063494b49b0f5e8c3833c9283c515'
    OR previous.config_hash<>encode(extensions.digest(jsonb_build_object('policyHash',previous.policy_hash,'cohort',previous.cohort,'scopeInputs',previous.scope_inputs,
      'forecastDays',7,'targetDays',previous.target_days,'providerContractRef',previous.provider_contract_ref,'evidenceSha256',previous.evidence_sha256,'qualificationRule',rule)::text,'sha256'),'hex')
    OR previous.scope_inputs IS DISTINCT FROM public.swell_watch_study_scope_inputs(previous.cohort) THEN
    RAISE EXCEPTION 'exact reviewed epoch 6 study authority required';
  END IF;
  expected_hash := encode(extensions.digest(jsonb_build_object('policyHash',new_hash,'cohort',previous.cohort,'scopeInputs',previous.scope_inputs,
    'forecastDays',7,'targetDays',previous.target_days,'providerContractRef',previous.provider_contract_ref,'evidenceSha256',evidence_sha256,'qualificationRule',rule)::text,'sha256'),'hex');
  SELECT * INTO latest_policy FROM public.swell_watch_evaluation_policies ORDER BY epoch DESC LIMIT 1;
  SELECT * INTO latest FROM public.swell_watch_study_authorities ORDER BY epoch DESC LIMIT 1;
  IF latest.epoch=7 AND latest.state='active' AND latest.policy_hash=new_hash AND latest.cohort=previous.cohort AND latest.scope_inputs=previous.scope_inputs
    AND latest.config_hash=expected_hash AND latest.target_days=previous.target_days AND latest.provider_contract_ref=previous.provider_contract_ref
    AND latest.evidence_sha256=evidence_sha256 AND latest.reviewer=reviewer AND latest.qualification_rule=rule AND latest.expires_at=previous.expires_at
    AND latest.not_before=latest.created_at AND latest.not_before>=previous.not_before AND latest.not_before<=clock_timestamp()
    AND latest_policy.epoch=4 AND latest_policy.state='active' AND latest_policy.policy_hash=new_hash AND latest_policy.policy_values=new_values
    AND latest_policy.reviewer=policy_reviewer AND latest_policy.evidence_hash=evidence_sha256 AND latest_policy.expires_at=old_policy.expires_at THEN RETURN; END IF;
  IF latest.epoch<>6 OR latest.state<>'active' OR latest_policy.epoch<>3 THEN RAISE EXCEPTION 'unexpected study authority; exact activation retry only'; END IF;
  started_at := clock_timestamp();
  INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
    VALUES(4,'active',new_hash,new_values,policy_reviewer,evidence_sha256,started_at,old_policy.expires_at);
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule,created_at)
    SELECT 7,'active',new_hash,previous.cohort,previous.scope_inputs,expected_hash,previous.target_days,previous.provider_contract_ref,evidence_sha256,reviewer,started_at,previous.expires_at,rule,started_at;
END;
$activation$;
COMMIT;
