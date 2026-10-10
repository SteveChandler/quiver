-- Production-shaped ledger at authority epoch 6 / evaluation policy epoch 3, for the tracking activation scripts.
-- Requires swell-watch-study-clock.sql and swell-watch-study-activation.sql; disposable databases only.
INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
SELECT 3,'active',policy_hash,policy_values,'Steven Chandler (study extension 2026-09-18)',repeat('c',64),not_before,'2026-12-31T23:59:59Z'::timestamptz
FROM public.swell_watch_evaluation_policies WHERE epoch=2;
DO $$
DECLARE
  cohort jsonb := '[
    {"regionKey":"san-diego","sourcePointId":"01330afc-00d3-461b-88f3-b173774766f4"},
    {"regionKey":"orange-county","sourcePointId":"025cfc18-8357-49d6-994e-e0abf0a16f6d"},
    {"regionKey":"santa-cruz","sourcePointId":"2609a9ff-d247-4e0b-888f-a793ff7177a5"},
    {"regionKey":"oahu-south","sourcePointId":"2ac8b200-fdf2-4822-bcb1-3ec336b83d05"},
    {"regionKey":"san-diego","sourcePointId":"4b0cf129-c706-4e24-8210-2219defc5ea7"},
    {"regionKey":"oahu-north","sourcePointId":"6a0674ac-3e6d-49f3-9fd4-a4f1857c408a"},
    {"regionKey":"orange-county","sourcePointId":"72726bcb-bed0-4b76-8336-f90d7fb57159"},
    {"regionKey":"outer-banks","sourcePointId":"d264fbf8-0525-4d31-adb5-9a0742eaeb7e"},
    {"regionKey":"san-francisco","sourcePointId":"e8a921b7-c2b5-4259-9e5c-bd06765f7ae4"},
    {"regionKey":"rincon-pr","sourcePointId":"f11ccd59-b778-4ea1-a8ff-88bffb447cd8"}]'::jsonb;
  inputs jsonb; n integer; rule text; started timestamptz; expiry timestamptz; reviewer text; evidence text;
  contract text := 'automated-study.v1: pinned Open-Meteo Single Runs requests; validated raw and semantic receipts; response does not echo issuance; no-send study only';
BEGIN
  inputs := public.swell_watch_study_scope_inputs(cohort);
  FOR n IN 1..6 LOOP
    rule := CASE WHEN n<=2 THEN 'complete_partitions.v1' WHEN n=3 THEN 'primary_partition_with_retained_unavailable_secondary.v1'
      WHEN n=4 THEN 'model_reported_partition_count.v1' ELSE 'model_reported_swell_system_count.v1' END;
    started := CASE n WHEN 6 THEN '2026-09-19T01:31:16.191501Z'::timestamptz ELSE ('2026-09-1' || n || 'T00:00:00Z')::timestamptz END;
    expiry := CASE WHEN n=6 THEN '2026-12-31T23:59:59Z'::timestamptz ELSE '2026-10-25T02:45:47.591003Z'::timestamptz END;
    reviewer := CASE WHEN n=6 THEN 'automated-study.v5 extension under Steven Chandler authorization 2026-09-18' ELSE 'fixture epoch ' || n END;
    evidence := CASE WHEN n=6 THEN '57af09901b522edabcff159d8b45605cf90063494b49b0f5e8c3833c9283c515' ELSE repeat(n::text,64) END;
    INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule,created_at)
    VALUES(n,'active','86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f',cohort,inputs,
      encode(extensions.digest((jsonb_build_object('policyHash','86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f','cohort',cohort,'scopeInputs',inputs,
        'forecastDays',7,'targetDays',30,'providerContractRef',contract,'evidenceSha256',evidence)
        || CASE WHEN rule='complete_partitions.v1' THEN '{}'::jsonb ELSE jsonb_build_object('qualificationRule',rule) END)::text,'sha256'),'hex'),
      30,contract,evidence,reviewer,started,expiry,rule,started);
  END LOOP;
END $$;
