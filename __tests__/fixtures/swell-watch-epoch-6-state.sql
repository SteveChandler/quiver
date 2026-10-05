-- Production-shaped epoch-6 ledger (policy epoch 3, authority epochs 1-6) on the disposable migrated schema.
-- Run after swell-watch-study-activation.sql; config hashes use the guard's formula so every insert passes the real trigger.
DO $fixture$
DECLARE
  cohort jsonb := '[
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
  inputs jsonb := public.swell_watch_study_scope_inputs(cohort);
  contract text := 'automated-study.v1: pinned Open-Meteo Single Runs requests; validated raw and semantic receipts; response does not echo issuance; no-send study only';
  v_hash text; v_epoch int; v_rule text; v_evidence text; v_reviewer text; v_expiry timestamptz;
BEGIN
  SELECT p.policy_hash INTO v_hash FROM public.swell_watch_evaluation_policies p WHERE p.epoch=2;
  INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
    SELECT 3,'active',p.policy_hash,p.policy_values,'Steven Chandler (study extension 2026-09-18)',
      'ae96b46ba9491d20eea6d285c22791efc670aa8e414bdedd284ec954ecae8cec',p.not_before,'2026-12-31T23:59:59Z'::timestamptz
    FROM public.swell_watch_evaluation_policies p WHERE p.epoch=2;
  FOR v_epoch IN 1..6 LOOP
    v_rule := CASE v_epoch WHEN 3 THEN 'primary_partition_with_retained_unavailable_secondary.v1' WHEN 4 THEN 'model_reported_partition_count.v1'
      WHEN 5 THEN 'model_reported_swell_system_count.v1' WHEN 6 THEN 'model_reported_swell_system_count.v1' ELSE 'complete_partitions.v1' END;
    v_evidence := CASE WHEN v_epoch>=5 THEN '57af09901b522edabcff159d8b45605cf90063494b49b0f5e8c3833c9283c515' ELSE repeat(v_epoch::text,64) END;
    v_reviewer := CASE v_epoch WHEN 6 THEN 'automated-study.v5 extension under Steven Chandler authorization 2026-09-18' ELSE 'fixture epoch '||v_epoch END;
    v_expiry := CASE WHEN v_epoch=6 THEN '2026-12-31T23:59:59Z'::timestamptz ELSE '2026-10-25T02:45:47.591003Z'::timestamptz END;
    INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule)
    VALUES(v_epoch,'active',v_hash,cohort,inputs,
      encode(extensions.digest((jsonb_build_object('policyHash',v_hash,'cohort',cohort,'scopeInputs',inputs,'forecastDays',7,'targetDays',30,'providerContractRef',contract,'evidenceSha256',v_evidence)
        || CASE WHEN v_rule='complete_partitions.v1' THEN '{}'::jsonb ELSE jsonb_build_object('qualificationRule',v_rule) END)::text,'sha256'),'hex'),
      30,contract,v_evidence,v_reviewer,clock_timestamp()-make_interval(hours=>(7-v_epoch)),v_expiry,v_rule);
  END LOOP;
END;
$fixture$;
