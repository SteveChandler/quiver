SELECT public.study_refresh_assert((SELECT count(*) FROM public.swell_watch_study_authorities)=2,'two authority epochs');
SELECT public.study_refresh_assert((SELECT fresh.not_before>old.not_before AND fresh.not_before<=clock_timestamp()
  AND fresh.expires_at=old.expires_at AND fresh.config_hash<>old.config_hash
  FROM public.swell_watch_study_authorities fresh JOIN public.swell_watch_study_authorities old ON old.epoch=1
  WHERE fresh.epoch=2),'fresh start and unchanged expiry');
SELECT public.study_refresh_assert(NOT public.swell_watch_provider_evidence_is_current(
  (SELECT provider_batch_id FROM public.swell_watch_study_evaluations LIMIT 1)),'old epoch evidence no longer current');
SELECT public.study_refresh_assert((SELECT to_jsonb(a) FROM public.swell_watch_study_authorities a WHERE epoch=1)
  =(SELECT to_jsonb(a) FROM public.study_refresh_original a),'exact original row retained');
SELECT public.study_refresh_assert(public.read_swell_watch_study_health()->>'status'='active'
  AND (public.read_swell_watch_study_health()->>'qualifyingDays')::integer=0
  AND (public.read_swell_watch_study_health()->>'suppressedAttempts')::integer=0
  AND (public.read_swell_watch_study_health()->>'evaluatedRuns')::integer=0,'new epoch accounting starts empty');
SELECT public.study_refresh_assert((SELECT jsonb_agg(to_jsonb(a)) FROM public.swell_watch_study_acceptances a)
  =(SELECT acceptances FROM public.study_refresh_history)
  AND (SELECT jsonb_agg(to_jsonb(e)) FROM public.swell_watch_study_evaluations e)
  =(SELECT evaluations FROM public.study_refresh_history),'acceptance and evaluation history retained');
SELECT public.study_refresh_assert(NOT EXISTS(SELECT 1 FROM public.swell_watch_production_approval_authority)
  AND NOT EXISTS(SELECT 1 FROM public.swell_watch_notification_event_bindings)
  AND EXISTS(SELECT 1 FROM public.swell_watch_get_automation_control() WHERE state='disabled'),'no sends or send authority');
DO $$
DECLARE before_batches bigint; before_sets bigint; r record; c record; a public.swell_watch_study_authorities; output jsonb;
BEGIN
 SELECT count(*) INTO before_batches FROM public.swell_watch_provider_run_batches;
 SELECT count(*) INTO before_sets FROM public.swell_watch_provider_run_revision_sets;
 BEGIN
   PERFORM public.record_swell_watch_provider_run_receipt(public.study_refresh_receipt((SELECT run_at FROM public.study_refresh_run)));
   RAISE EXCEPTION 'expected frozen issuance rejection';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM<>'provider receipt scope conflicts with frozen batch' THEN RAISE; END IF;
 END;
 PERFORM public.study_refresh_assert((SELECT count(*) FROM public.swell_watch_provider_run_batches)=before_batches
   AND (SELECT count(*) FROM public.swell_watch_provider_run_revision_sets)=before_sets,'frozen issuance failure atomic');
 -- The next issuance is a different immutable identity: acquisition can retain corrected coordinates.
 -- Both issuances are fresh within twelve hours; the corrected one can complete under epoch2.
 SELECT * INTO r FROM public.record_swell_watch_provider_run_receipt(
   public.study_refresh_receipt((SELECT run_at+interval '6 hours' FROM public.study_refresh_run)));
 PERFORM public.study_refresh_assert(r.revision_set_id IS NOT NULL
   AND (SELECT count(*) FROM public.swell_watch_provider_run_batches)=before_batches+1,'next issuance collects new scope');
 PERFORM public.study_refresh_assert(EXISTS(SELECT 1 FROM public.swell_watch_provider_run_batch_scopes
   WHERE batch_id=r.run_batch_id AND source_point_id='e8a921b7-c2b5-4259-9e5c-bd06765f7ae4'
     AND requested_lon=-122.51229),'next issuance pins corrected longitude');
 SELECT * INTO a FROM public.swell_watch_study_authorities WHERE epoch=2;
 SELECT * INTO c FROM public.complete_swell_watch_study_run(r.revision_set_id,a.policy_hash,a.cohort,a.scope_inputs);
 PERFORM public.study_refresh_assert(c.provider_batch_id IS NOT NULL AND NOT c.already_evaluated,'corrected issuance completed under epoch2');
 output:=jsonb_build_object('providerBatchId',c.provider_batch_id,'policyHash',a.policy_hash,'status','suppressed','reason','missing_partition',
   'enqueued',0,'sendEligibility','not_evaluated','scopeOutcomes',(SELECT jsonb_agg(jsonb_build_object('sourcePointId',s->>'sourcePointId','status','suppressed','reason','missing_partition')) FROM jsonb_array_elements(a.cohort) s));
 PERFORM public.study_refresh_assert(public.record_swell_watch_study_evaluation(c.provider_batch_id,a.policy_hash,output,a.scope_inputs)
   ='{"recorded":true}'::jsonb,'corrected issuance evaluation recorded');
END; $$;
