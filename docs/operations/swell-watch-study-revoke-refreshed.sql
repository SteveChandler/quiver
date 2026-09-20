-- Revoke only the reviewed epoch2 Ocean Beach SF refresh; retain every historical row.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
DO $revoke$
DECLARE
  original public.swell_watch_study_authorities;
  refreshed public.swell_watch_study_authorities;
  expected_inputs jsonb;
  expected_hash text;
  revoked public.swell_watch_study_authorities;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  SELECT * INTO original FROM public.swell_watch_study_authorities WHERE epoch=1;
  IF NOT FOUND OR original.state<>'active'
    OR original.config_hash<>'28cc3999f6501cce85ae5c5349c082b414989fa8bee1263cc5f5013cf8fac2fe'
    OR original.evidence_sha256<>'d2733c02f8903601e140a51a7a7e0d5a89c3f6d54b63988960c35420bb2d216b'
    OR original.policy_hash<>'86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f'
    OR original.expires_at<>'2026-10-25T02:45:47.591003Z'::timestamptz
    OR original.target_days<>30
    OR original.reviewer<>'automated-study.v1 under Steven Chandler standing authorization'
    OR (SELECT count(*) FROM jsonb_array_elements(original.scope_inputs) s
      WHERE s->>'sourcePointId'='e8a921b7-c2b5-4259-9e5c-bd06765f7ae4'
        AND s->'longitude'='-122.513'::jsonb)<>1 THEN
    RAISE EXCEPTION 'unexpected original study authority';
  END IF;
  SELECT jsonb_agg(CASE WHEN s->>'sourcePointId'='e8a921b7-c2b5-4259-9e5c-bd06765f7ae4'
    THEN jsonb_set(s,'{longitude}','-122.51229'::jsonb,false) ELSE s END ORDER BY s->>'sourcePointId')
    INTO expected_inputs FROM jsonb_array_elements(original.scope_inputs) s;
  expected_hash := encode(extensions.digest(jsonb_build_object('policyHash',original.policy_hash,
    'cohort',original.cohort,'scopeInputs',expected_inputs,'forecastDays',7,'targetDays',original.target_days,
    'providerContractRef',original.provider_contract_ref,'evidenceSha256',original.evidence_sha256)::text,'sha256'),'hex');
  SELECT * INTO refreshed FROM public.swell_watch_study_authorities WHERE epoch=2;
  IF FOUND AND (refreshed.state<>'active' OR refreshed.scope_inputs<>expected_inputs
    OR refreshed.config_hash<>expected_hash OR refreshed.not_before<=original.not_before
    OR refreshed.not_before>refreshed.created_at
    OR (to_jsonb(refreshed)-'epoch'-'scope_inputs'-'config_hash'-'not_before'-'created_at')
      IS DISTINCT FROM (to_jsonb(original)-'epoch'-'scope_inputs'-'config_hash'-'not_before'-'created_at')) THEN
    RAISE EXCEPTION 'unexpected refreshed study authority';
  END IF;
  IF refreshed.epoch IS DISTINCT FROM 2 OR (SELECT max(epoch) FROM public.swell_watch_study_authorities)>3 THEN
    RAISE EXCEPTION 'reviewed epoch2 refresh required';
  END IF;
  SELECT * INTO revoked FROM public.swell_watch_study_authorities WHERE epoch=3;
  IF FOUND THEN
    IF revoked.state<>'revoked' OR (to_jsonb(revoked)-'epoch'-'state'-'created_at')
      IS DISTINCT FROM (to_jsonb(refreshed)-'epoch'-'state'-'created_at') THEN
      RAISE EXCEPTION 'unexpected refreshed study revocation';
    END IF;
    RETURN;
  END IF;
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at)
  VALUES(3,'revoked',refreshed.policy_hash,refreshed.cohort,refreshed.scope_inputs,refreshed.config_hash,refreshed.target_days,
    refreshed.provider_contract_ref,refreshed.evidence_sha256,refreshed.reviewer,refreshed.not_before,refreshed.expires_at);
END;
$revoke$;
COMMIT;
