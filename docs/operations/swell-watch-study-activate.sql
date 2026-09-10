-- Standing authorization for unattended no-send study runs; execute after migration and review.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $activation$
DECLARE
  policy public.swell_watch_evaluation_policies;
  v_cohort jsonb := '[
    {"sourcePointId":"01330afc-00d3-461b-88f3-b173774766f4","regionKey":"san-diego"},
    {"sourcePointId":"025cfc18-8357-49d6-994e-e0abf0a16f6d","regionKey":"orange-county"},
    {"sourcePointId":"2609a9ff-d247-4e0b-888f-a793ff7177a5","regionKey":"santa-cruz"},
    {"sourcePointId":"2ac8b200-fdf2-4822-bcb1-3ec336b83d05","regionKey":"oahu-south"},
    {"sourcePointId":"4b0cf129-c706-4e24-8210-2219defc5ea7","regionKey":"san-diego"},
    {"sourcePointId":"6a0674ac-3e6d-49f3-9fd4-a4f1857c408a","regionKey":"oahu-north"},
    {"sourcePointId":"72726bcb-bed0-4b76-8336-f90d7fb57159","regionKey":"orange-county"},
    {"sourcePointId":"d264fbf8-0525-4d31-adb5-9a0742eaeb7e","regionKey":"outer-banks"},
    {"sourcePointId":"e8a921b7-c2b5-4259-9e5c-bd06765f7ae4","regionKey":"san-francisco"},
    {"sourcePointId":"f11ccd59-b778-4ea1-a8ff-88bffb447cd8","regionKey":"rincon-pr"}
  ]'::jsonb;
  contract text := 'automated-study.v1: pinned Open-Meteo Single Runs requests; validated raw and semantic receipts; response does not echo issuance; no-send study only';
  evidence text := encode(extensions.digest('Steven Chandler authorized unattended acquisition, acceptance, completion, evaluation and study monitoring on 2026-09-10, and deployment after implementation, tests and independent review pass. Four complete fresh issuances per UTC day; thirty qualifying days; retain missingness and revocations; no send authority.','sha256'),'hex');
  expected_hash text;
  v_scope_inputs jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  SELECT * INTO policy FROM public.swell_watch_evaluation_policies ORDER BY epoch DESC LIMIT 1;
  IF NOT FOUND OR policy.epoch<>2 OR policy.state<>'active'
    OR policy.policy_hash<>'86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f'
    OR policy.evidence_hash<>'6ac158d19ffd55505609efae9ce6b634bea9d92342c133333fdc91fe29471403'
    OR policy.expires_at<>'2026-10-25T02:45:47.591003Z'::timestamptz
    OR clock_timestamp()<policy.not_before OR clock_timestamp()>=policy.expires_at
    OR NOT EXISTS(SELECT 1 FROM public.swell_watch_get_automation_control() c WHERE c.state='disabled')
    OR EXISTS(SELECT 1 FROM public.swell_watch_production_approval_authority) THEN
    RAISE EXCEPTION 'reviewed active evaluation policy and disabled sends required';
  END IF;
  v_scope_inputs := public.swell_watch_study_scope_inputs(v_cohort);
  expected_hash := encode(extensions.digest(jsonb_build_object('policyHash',policy.policy_hash,'cohort',v_cohort,'scopeInputs',v_scope_inputs,
    'forecastDays',7,'targetDays',30,'providerContractRef',contract,'evidenceSha256',evidence)::text,'sha256'),'hex');
  IF EXISTS(SELECT 1 FROM public.swell_watch_study_authorities) THEN
    IF (SELECT count(*) FROM public.swell_watch_study_authorities)=1 AND EXISTS(
      SELECT 1 FROM public.swell_watch_study_authorities a WHERE a.epoch=1 AND a.state='active'
        AND a.config_hash=expected_hash AND a.policy_hash=policy.policy_hash AND a.cohort=v_cohort
        AND a.scope_inputs=v_scope_inputs
        AND a.target_days=30 AND a.provider_contract_ref=contract AND a.evidence_sha256=evidence
        AND a.reviewer='automated-study.v1 under Steven Chandler standing authorization'
        AND a.expires_at=policy.expires_at) THEN RETURN; END IF;
    RAISE EXCEPTION 'unexpected study authority; exact retry only';
  END IF;
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,
    provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at)
  VALUES(1,'active',policy.policy_hash,v_cohort,v_scope_inputs,expected_hash,30,contract,evidence,
    'automated-study.v1 under Steven Chandler standing authorization',clock_timestamp(),policy.expires_at);
END;
$activation$;
COMMIT;
