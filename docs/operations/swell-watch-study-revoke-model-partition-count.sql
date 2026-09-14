-- Exact retry only; keep all evidence and the widened rule constraint.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $revoke$
DECLARE original public.swell_watch_study_authorities; latest public.swell_watch_study_authorities;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT * INTO original FROM public.swell_watch_study_authorities WHERE epoch=4;
  IF NOT FOUND OR original.state<>'active' OR original.qualification_rule<>'model_reported_partition_count.v1'
    OR original.reviewer<>'automated-study.v3 model-reported-partition-count amendment under Steven Chandler authorization 2026-09-14' THEN RAISE EXCEPTION 'exact reviewed epoch 4 study authority required'; END IF;
  SELECT * INTO latest FROM public.swell_watch_study_authorities ORDER BY epoch DESC LIMIT 1;
  IF latest.epoch=5 AND latest.state='revoked' AND to_jsonb(latest)-'epoch'-'state'-'created_at'=to_jsonb(original)-'epoch'-'state'-'created_at' THEN RETURN; END IF;
  IF latest.epoch<>4 OR latest.state<>'active' THEN RAISE EXCEPTION 'unexpected study authority; exact amendment revocation retry only'; END IF;
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule)
  SELECT 5,'revoked',policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule FROM public.swell_watch_study_authorities WHERE epoch=4;
END;
$revoke$;
COMMIT;
