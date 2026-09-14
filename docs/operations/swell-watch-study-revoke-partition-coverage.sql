-- Revoke only the reviewed amendment; keep receipts, results and the qualification_rule column.
-- Then, if reverting the application, restore functions with swell-watch-study-partition-coverage-rollback.sql.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $revocation$
DECLARE latest public.swell_watch_study_authorities; original public.swell_watch_study_authorities;
  previous public.swell_watch_study_authorities;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT * INTO previous FROM public.swell_watch_study_authorities WHERE epoch=2;
  IF NOT FOUND OR previous.epoch<>2 OR previous.state<>'active'
    OR previous.config_hash<>'7390521c13f45cb5a1ce9a0cbe7a53d092a2e05ff187e5f2b773b75df74b3d7e'
    OR previous.evidence_sha256<>'d2733c02f8903601e140a51a7a7e0d5a89c3f6d54b63988960c35420bb2d216b'
    OR previous.reviewer<>'automated-study.v1 under Steven Chandler standing authorization'
    OR previous.target_days<>30 OR previous.qualification_rule<>'complete_partitions.v1'
    OR previous.provider_contract_ref<>'automated-study.v1: pinned Open-Meteo Single Runs requests; validated raw and semantic receipts; response does not echo issuance; no-send study only'
    OR previous.policy_hash<>'86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f'
    OR previous.expires_at<>'2026-10-25T02:45:47.591003Z'::timestamptz THEN
    RAISE EXCEPTION 'exact reviewed epoch 2 study authority required';
  END IF;
  SELECT * INTO original FROM public.swell_watch_study_authorities WHERE epoch=3;
  IF NOT FOUND OR original.state<>'active' OR original.qualification_rule<>'primary_partition_with_retained_unavailable_secondary.v1'
    OR original.reviewer<>'automated-study.v2 partition-coverage amendment under Steven Chandler authorization 2026-09-14'
    OR original.evidence_sha256<>'fdc98be5924a9671f73791375e4bff7c8b598e08f36b5284a14bac4c74218994'
    OR original.policy_hash<>previous.policy_hash OR original.cohort<>previous.cohort
    OR original.scope_inputs<>previous.scope_inputs OR original.target_days<>previous.target_days
    OR original.provider_contract_ref<>previous.provider_contract_ref OR original.expires_at<>previous.expires_at THEN
    RAISE EXCEPTION 'unexpected study authority; review before revoking amendment';
  END IF;
  SELECT * INTO latest FROM public.swell_watch_study_authorities ORDER BY epoch DESC LIMIT 1;
  IF latest.epoch=4 AND latest.state='revoked'
    AND to_jsonb(latest)-'epoch'-'state'-'created_at'=to_jsonb(original)-'epoch'-'state'-'created_at' THEN RETURN; END IF;
  IF latest.epoch<>3 THEN RAISE EXCEPTION 'unexpected study authority; exact amendment revocation retry only'; END IF;
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,
    provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule)
  SELECT 4,'revoked',original.policy_hash,original.cohort,original.scope_inputs,original.config_hash,original.target_days,
    original.provider_contract_ref,original.evidence_sha256,original.reviewer,original.not_before,original.expires_at,original.qualification_rule
  WHERE NOT EXISTS(SELECT 1 FROM public.swell_watch_study_authorities WHERE epoch=4);
END;
$revocation$;
COMMIT;
