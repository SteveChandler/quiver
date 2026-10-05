-- Restores the epoch-6 detector (policy 86616945..., 1.25 energy gate, forecast-front baseline, gate-frame timing) as a new
-- policy epoch 5 and study authority epoch 8 (or 9 when epoch 7 was already revoked as epoch 8). Exact retry only; sends stay disabled.
-- Detector evidence recorded under epoch 7 is retained. A new authority epoch starts a new study cycle, so epoch 5/6 qualifying days do not return.
-- Deploy the epoch-6 producer config (docs/operations/swell-watch-no-send-producer-config-v2-proposed.json) at the same time.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $rollback$
DECLARE
  old_policy public.swell_watch_evaluation_policies; latest_policy public.swell_watch_evaluation_policies;
  original public.swell_watch_study_authorities; epoch7 public.swell_watch_study_authorities; latest public.swell_watch_study_authorities;
  rule text := 'model_reported_swell_system_count.v1';
  approval text := 'Steven Chandler authorized returning the no-send Swell Watch study to the epoch 6 detector (2.0 gate, trailing baseline and ramp timing withdrawn); same cohort, scope inputs, qualification rule, expiry and target; sends remain disabled.';
  reviewer text := 'automated-study.v5 extension restored by detector epoch 7 rollback under Steven Chandler authorization';
  policy_reviewer text := 'Steven Chandler (detector epoch 7 rollback)';
  evidence_sha256 text; expected_hash text; started_at timestamptz; next_epoch bigint;
BEGIN
  IF current_user<>'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  IF NOT EXISTS(SELECT 1 FROM public.swell_watch_get_automation_control() c WHERE c.state='disabled')
    OR EXISTS(SELECT 1 FROM public.swell_watch_production_approval_authority) THEN RAISE EXCEPTION 'disabled sends required'; END IF;
  evidence_sha256 := encode(extensions.digest(approval,'sha256'),'hex');
  SELECT * INTO old_policy FROM public.swell_watch_evaluation_policies WHERE epoch=3;
  SELECT * INTO original FROM public.swell_watch_study_authorities WHERE epoch=6;
  SELECT * INTO epoch7 FROM public.swell_watch_study_authorities WHERE epoch=7;
  IF old_policy.policy_hash IS DISTINCT FROM '86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f' OR original.state IS DISTINCT FROM 'active'
    OR original.policy_hash IS DISTINCT FROM old_policy.policy_hash OR epoch7.policy_hash IS DISTINCT FROM 'ee9bb5cf5a8e0181cad42510e6a8f4469f5ec9d5701387baebeedbe39df01a39'
    OR epoch7.state IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'exact reviewed epoch 6 and epoch 7 study authorities required';
  END IF;
  expected_hash := encode(extensions.digest(jsonb_build_object('policyHash',old_policy.policy_hash,'cohort',original.cohort,'scopeInputs',original.scope_inputs,
    'forecastDays',7,'targetDays',original.target_days,'providerContractRef',original.provider_contract_ref,'evidenceSha256',evidence_sha256,'qualificationRule',rule)::text,'sha256'),'hex');
  SELECT * INTO latest_policy FROM public.swell_watch_evaluation_policies ORDER BY epoch DESC LIMIT 1;
  SELECT * INTO latest FROM public.swell_watch_study_authorities ORDER BY epoch DESC LIMIT 1;
  IF latest.epoch>=8 AND latest.state='active' AND latest.policy_hash=old_policy.policy_hash AND latest.cohort=original.cohort AND latest.scope_inputs=original.scope_inputs
    AND latest.config_hash=expected_hash AND latest.evidence_sha256=evidence_sha256 AND latest.reviewer=reviewer AND latest.qualification_rule=rule
    AND latest.expires_at=original.expires_at AND latest.not_before=latest.created_at AND latest.not_before<=clock_timestamp()
    AND latest_policy.epoch=5 AND latest_policy.state='active' AND latest_policy.policy_hash=old_policy.policy_hash
    AND latest_policy.policy_values=old_policy.policy_values AND latest_policy.reviewer=policy_reviewer AND latest_policy.evidence_hash=evidence_sha256 THEN RETURN; END IF;
  IF NOT ((latest.epoch=7 AND latest.state='active') OR (latest.epoch=8 AND latest.state='revoked'
    AND to_jsonb(latest)-'epoch'-'state'-'created_at'=to_jsonb(epoch7)-'epoch'-'state'-'created_at')) OR latest_policy.epoch<>4 THEN
    RAISE EXCEPTION 'unexpected study authority; exact rollback retry only';
  END IF;
  started_at := clock_timestamp();
  next_epoch := latest.epoch+1;
  INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
    VALUES(5,'active',old_policy.policy_hash,old_policy.policy_values,policy_reviewer,evidence_sha256,started_at,old_policy.expires_at);
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule,created_at)
    SELECT next_epoch,'active',old_policy.policy_hash,original.cohort,original.scope_inputs,expected_hash,original.target_days,original.provider_contract_ref,evidence_sha256,reviewer,started_at,original.expires_at,rule,started_at;
END;
$rollback$;
COMMIT;
