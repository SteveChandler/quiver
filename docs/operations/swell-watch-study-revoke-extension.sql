-- Epoch 7 revocation ends the shared epoch-5/6 study cycle; rows and evidence remain append-only.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $revoke$
DECLARE original public.swell_watch_study_authorities; latest public.swell_watch_study_authorities;
BEGIN
  IF current_user<>'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT * INTO original FROM public.swell_watch_study_authorities WHERE epoch=6;
  IF NOT FOUND OR original.state<>'active' THEN RAISE EXCEPTION 'exact reviewed epoch 6 study authority required'; END IF;
  SELECT * INTO latest FROM public.swell_watch_study_authorities ORDER BY epoch DESC LIMIT 1;
  IF latest.epoch=7 AND latest.state='revoked' AND to_jsonb(latest)-'epoch'-'state'-'created_at'=to_jsonb(original)-'epoch'-'state'-'created_at' THEN RETURN; END IF;
  IF latest.epoch<>6 OR latest.state<>'active' THEN RAISE EXCEPTION 'unexpected study authority; exact extension revocation retry only'; END IF;
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule)
    SELECT 7,'revoked',policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule FROM public.swell_watch_study_authorities WHERE epoch=6;
END;
$revoke$;
COMMIT;
