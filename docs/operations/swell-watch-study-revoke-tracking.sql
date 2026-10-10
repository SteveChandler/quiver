-- Epoch 7 (sub-floor tracking) revocation. Blocks the study until a new reviewed authority is activated.
-- Resuming afterwards needs its own exact amendment; this script does not restore epoch 6.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $revoke$
DECLARE original public.swell_watch_study_authorities; latest public.swell_watch_study_authorities;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT * INTO original FROM public.swell_watch_study_authorities WHERE epoch=7;
  IF NOT FOUND OR original.state<>'active' OR original.tracking_mode<>'sub_floor_tracking.v1' THEN RAISE EXCEPTION 'exact reviewed epoch 7 study authority required'; END IF;
  SELECT * INTO latest FROM public.swell_watch_study_authorities ORDER BY epoch DESC LIMIT 1;
  IF latest.epoch=8 AND latest.state='revoked' AND to_jsonb(latest)-'epoch'-'state'-'created_at'=to_jsonb(original)-'epoch'-'state'-'created_at' THEN RETURN; END IF;
  IF latest.epoch<>7 OR latest.state<>'active' THEN RAISE EXCEPTION 'unexpected study authority; exact amendment revocation retry only'; END IF;
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule,tracking_mode)
  SELECT 8,'revoked',policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule,tracking_mode FROM public.swell_watch_study_authorities WHERE epoch=7;
END;
$revoke$;
COMMIT;
