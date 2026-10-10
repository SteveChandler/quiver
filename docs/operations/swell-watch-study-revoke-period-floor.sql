-- Epoch 8 (period floor) revocation. The v3 evaluation policy stays the latest policy, so the study remains
-- blocked (study_authority_revoked) until a new reviewed policy and authority are activated; reverting to the
-- 86616945... policy needs its own amendment, not this script.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $revoke$
DECLARE original public.swell_watch_study_authorities; latest public.swell_watch_study_authorities;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT * INTO original FROM public.swell_watch_study_authorities WHERE epoch=8;
  IF NOT FOUND OR original.state<>'active' OR original.policy_hash<>'f5535096a2eb18e911f22a9adf0dbd2e17b5b214c6c266e5659c3959c86eb95e' THEN RAISE EXCEPTION 'exact reviewed epoch 8 study authority required'; END IF;
  SELECT * INTO latest FROM public.swell_watch_study_authorities ORDER BY epoch DESC LIMIT 1;
  IF latest.epoch=9 AND latest.state='revoked' AND to_jsonb(latest)-'epoch'-'state'-'created_at'=to_jsonb(original)-'epoch'-'state'-'created_at' THEN RETURN; END IF;
  IF latest.epoch<>8 OR latest.state<>'active' THEN RAISE EXCEPTION 'unexpected study authority; exact amendment revocation retry only'; END IF;
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule,tracking_mode)
  SELECT 9,'revoked',policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule,tracking_mode FROM public.swell_watch_study_authorities WHERE epoch=8;
END;
$revoke$;
COMMIT;
