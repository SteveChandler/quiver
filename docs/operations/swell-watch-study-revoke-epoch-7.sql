-- Epoch 8 revocation stops the epoch-7 detector study; rows and evidence remain append-only. Exact retry only.
-- To return to the epoch-6 detector instead, use swell-watch-study-rollback-epoch-7.sql.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $revoke$
DECLARE original public.swell_watch_study_authorities; latest public.swell_watch_study_authorities;
BEGIN
  IF current_user<>'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT * INTO original FROM public.swell_watch_study_authorities WHERE epoch=7;
  IF NOT FOUND OR original.state<>'active' OR original.policy_hash<>'ee9bb5cf5a8e0181cad42510e6a8f4469f5ec9d5701387baebeedbe39df01a39' THEN
    RAISE EXCEPTION 'exact reviewed epoch 7 study authority required';
  END IF;
  SELECT * INTO latest FROM public.swell_watch_study_authorities ORDER BY epoch DESC LIMIT 1;
  IF latest.epoch=8 AND latest.state='revoked' AND to_jsonb(latest)-'epoch'-'state'-'created_at'=to_jsonb(original)-'epoch'-'state'-'created_at' THEN RETURN; END IF;
  IF latest.epoch<>7 OR latest.state<>'active' THEN RAISE EXCEPTION 'unexpected study authority; exact epoch 7 revocation retry only'; END IF;
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule)
    SELECT 8,'revoked',policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule
    FROM public.swell_watch_study_authorities WHERE epoch=7;
END;
$revoke$;
COMMIT;
