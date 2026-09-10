-- Stop automated study authority without deleting collected evidence or renewing expiry.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $revocation$
DECLARE latest public.swell_watch_study_authorities;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT * INTO latest FROM public.swell_watch_study_authorities ORDER BY epoch DESC LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  IF latest.epoch NOT IN (1,2) OR latest.policy_hash<>'86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f'
    OR latest.reviewer<>'automated-study.v1 under Steven Chandler standing authorization' THEN
    RAISE EXCEPTION 'unexpected study authority; review before revoking';
  END IF;
  IF latest.epoch=2 AND latest.state='revoked' AND EXISTS(
    SELECT 1 FROM public.swell_watch_study_authorities original WHERE original.epoch=1 AND original.state='active'
      AND original.config_hash=latest.config_hash AND original.cohort=latest.cohort AND original.scope_inputs=latest.scope_inputs
      AND original.policy_hash=latest.policy_hash AND original.evidence_sha256=latest.evidence_sha256
      AND original.provider_contract_ref=latest.provider_contract_ref AND original.reviewer=latest.reviewer
      AND original.not_before=latest.not_before AND original.expires_at=latest.expires_at
      AND original.target_days=latest.target_days) THEN RETURN; END IF;
  IF latest.epoch<>1 OR latest.state<>'active' THEN RAISE EXCEPTION 'unexpected revoked study authority'; END IF;
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,
    provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at)
  VALUES(latest.epoch+1,'revoked',latest.policy_hash,latest.cohort,latest.scope_inputs,latest.config_hash,latest.target_days,
    latest.provider_contract_ref,latest.evidence_sha256,latest.reviewer,latest.not_before,latest.expires_at);
END;
$revocation$;
COMMIT;
