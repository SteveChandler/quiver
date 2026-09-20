-- Approved Ocean Beach SF longitude correction only. No catalog writes or send authority.
-- Existing issuance batches remain frozen; acquisition may need the next provider issuance.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
DO $refresh$
DECLARE
  original public.swell_watch_study_authorities;
  refreshed public.swell_watch_study_authorities;
  expected_inputs jsonb;
  expected_hash text;
  policy public.swell_watch_evaluation_policies;
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
  IF (SELECT max(epoch) FROM public.swell_watch_study_authorities)>2 THEN
    RAISE EXCEPTION 'unexpected study authority epoch';
  END IF;
  SELECT * INTO policy FROM public.swell_watch_evaluation_policies ORDER BY epoch DESC LIMIT 1;
  IF NOT FOUND OR policy.epoch<>2 OR policy.state<>'active' OR policy.policy_hash<>original.policy_hash
    OR policy.evidence_hash<>'6ac158d19ffd55505609efae9ce6b634bea9d92342c133333fdc91fe29471403'
    OR policy.expires_at<>original.expires_at OR clock_timestamp()<policy.not_before
    OR clock_timestamp()>=policy.expires_at
    OR NOT EXISTS(SELECT 1 FROM public.swell_watch_get_automation_control() c WHERE c.state='disabled')
    OR EXISTS(SELECT 1 FROM public.swell_watch_production_approval_authority) THEN
    RAISE EXCEPTION 'reviewed active evaluation policy and disabled sends required';
  END IF;
  PERFORM 1 FROM public.beaches b WHERE b.id IN
    (SELECT (s->>'sourcePointId')::uuid FROM jsonb_array_elements(original.cohort) s) ORDER BY b.id FOR SHARE;
  IF public.swell_watch_study_scope_inputs(original.cohort) IS DISTINCT FROM expected_inputs THEN
    RAISE EXCEPTION 'only approved Ocean Beach SF longitude correction permitted';
  END IF;
  IF refreshed.epoch=2 THEN RETURN; END IF;
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at)
  VALUES(2,'active',original.policy_hash,original.cohort,expected_inputs,expected_hash,original.target_days,
    original.provider_contract_ref,original.evidence_sha256,original.reviewer,clock_timestamp(),original.expires_at);
END;
$refresh$;
COMMIT;
