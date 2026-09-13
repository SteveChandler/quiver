BEGIN;
INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
VALUES(1,'active',repeat('a',64),:'policy_values'::jsonb,'fixture-only',repeat('b',64),now()-interval '1 hour',now()+interval '1 hour');
DO $$
DECLARE beach uuid := gen_random_uuid(); revision uuid; batch uuid; event uuid; found_event uuid;
  recipient uuid := gen_random_uuid(); pairs jsonb; demand jsonb; retried jsonb;
  baseline_queue bigint; baseline_control jsonb;
BEGIN
  IF EXISTS(SELECT 1 FROM public.swell_watch_production_approval_authority) THEN RAISE EXCEPTION 'push authority must be empty'; END IF;
  SELECT count(*) INTO baseline_queue FROM public.notification_events;
  SELECT to_jsonb(c) INTO baseline_control FROM public.swell_watch_get_automation_control() c;
  INSERT INTO public.beaches(id,name,lat,lon) VALUES(beach,'Evaluation policy fixture',21,-157);
  SELECT revision_set_id INTO revision FROM public.record_swell_watch_provider_run_receipt(
    public.fixture_provider_run_scopes('2026-08-01T00:00Z',1,1,ARRAY[beach]));
  PERFORM public.attest_swell_watch_provider_run(gen_random_uuid(),revision,'accepted','fixture',repeat('c',64),'fixture-only');
  SELECT provider_batch_id INTO batch FROM public.complete_swell_watch_provider_run_receipt(revision);
  SELECT regional_event_id INTO event FROM public.resolve_and_ingest_swell_watch_evaluation(
    batch,gen_random_uuid(),gen_random_uuid(),beach,'evaluation-policy-fixture','fixture','2026-08-01T00:00Z','s1',
    1,12,170,2,'fixture',repeat('a',64),repeat('d',64),'2026-08-03T00:00Z','2026-08-03T06:00Z');
  IF event IS NULL THEN RAISE EXCEPTION 'empty-authority detection failed'; END IF;
  SELECT regional_event_id INTO found_event FROM public.resolve_and_ingest_swell_watch_evaluation(
    batch,gen_random_uuid(),gen_random_uuid(),beach,'evaluation-policy-fixture','fixture','2026-08-01T00:00Z','s1',
    1,12,170,2,'fixture',repeat('a',64),repeat('d',64),'2026-08-03T00:00Z','2026-08-03T06:00Z');
  IF found_event IS DISTINCT FROM event THEN RAISE EXCEPTION 'evaluation retry identity changed'; END IF;
  INSERT INTO auth.users(id) VALUES(recipient);
  -- Seed independent historical demand only inside this rolled-back local fixture.
  WITH users AS (
    INSERT INTO auth.users(id) SELECT gen_random_uuid() FROM generate_series(1,3) RETURNING id
  ), numbered AS (SELECT id,row_number() OVER (ORDER BY id) AS n FROM users)
  INSERT INTO public.swell_watch_shadow_demand_pairs(regional_event_id,recipient_id,first_observed_at)
    SELECT event,id,clock_timestamp()+CASE n WHEN 1 THEN interval '-25 hours'
      WHEN 2 THEN interval '-23 hours' ELSE interval '1 hour' END FROM numbered;
  pairs := jsonb_build_array(jsonb_build_object('regional_event_id',event,'recipient_id',recipient));
  SELECT to_jsonb(d) INTO demand FROM public.record_swell_watch_shadow_demand(batch,repeat('a',64),pairs) d;
  SELECT to_jsonb(d) INTO retried FROM public.record_swell_watch_shadow_demand(batch,repeat('a',64),pairs) d;
  IF demand IS DISTINCT FROM retried OR demand->>'recorded_pairs_24h' IS DISTINCT FROM '2'
    OR (SELECT count(*) FROM public.swell_watch_shadow_demand_pairs) <> 4 THEN
    RAISE EXCEPTION 'shadow demand retry changed count or observation clock';
  END IF;
  BEGIN
    PERFORM public.record_swell_watch_shadow_demand(batch,repeat('a',64),'[]'::jsonb);
    RAISE EXCEPTION 'changed demand accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'shadow evaluation demand changed' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM public.swell_watch_get_production_authority())
    OR (SELECT count(*) FROM public.notification_events) <> baseline_queue
    OR (SELECT to_jsonb(c) FROM public.swell_watch_get_automation_control() c) IS DISTINCT FROM baseline_control
    OR EXISTS(SELECT 1 FROM public.swell_watch_notification_event_bindings) THEN
    RAISE EXCEPTION 'evaluation created send authority or queue state';
  END IF;
  BEGIN
    PERFORM public.read_swell_watch_delivery_health(repeat('a',64));
    RAISE EXCEPTION 'evaluation policy authorized delivery';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'current delivery policy authority is required' THEN RAISE; END IF;
  END;
  INSERT INTO public.swell_watch_evaluation_policies
    SELECT 2,'revoked',policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at,clock_timestamp()
    FROM public.swell_watch_evaluation_policies WHERE epoch=1;
  BEGIN
    PERFORM public.resolve_and_ingest_swell_watch_evaluation(
      batch,gen_random_uuid(),gen_random_uuid(),beach,'evaluation-policy-fixture','fixture','2026-08-01T00:00Z','s1',
      1,12,170,2,'fixture',repeat('a',64),repeat('d',64),'2026-08-03T00:00Z','2026-08-03T06:00Z');
    RAISE EXCEPTION 'revoked policy allowed detection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'current matching policy authority is required' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM public.swell_watch_get_matching_policy()) THEN RAISE EXCEPTION 'revoked policy fallback'; END IF;
  IF EXISTS(SELECT 1 FROM (VALUES('anon'),('authenticated'),('service_role')) roles(name)
    WHERE has_table_privilege(name,'public.swell_watch_evaluation_policies','INSERT')
      OR has_function_privilege(name,'public.swell_watch_get_matching_policy()','EXECUTE')) THEN
    RAISE EXCEPTION 'runtime role can authorize policy';
  END IF;
END;
$$;
ROLLBACK;

BEGIN;
SELECT set_config('fixture.evaluation_policy',:'policy_values',true);
SELECT set_config('app.swell_watch_internal_write','on',true);
DO $$
DECLARE beach uuid := gen_random_uuid(); revision uuid; batch uuid; authority uuid; mode text;
  values_json jsonb := current_setting('fixture.evaluation_policy')::jsonb; start_at timestamptz; end_at timestamptz;
BEGIN
  IF EXISTS(SELECT 1 FROM public.swell_watch_evaluation_policies) THEN RAISE EXCEPTION 'fallback test has evaluation policy'; END IF;
  INSERT INTO public.beaches(id,name,lat,lon) VALUES(beach,'Fallback demand fixture',21,-157);
  SELECT revision_set_id INTO revision FROM public.record_swell_watch_provider_run_receipt(
    public.fixture_provider_run_scopes('2026-08-02T00:00Z',1,1,ARRAY[beach]));
  PERFORM public.attest_swell_watch_provider_run(gen_random_uuid(),revision,'accepted','fixture',repeat('c',64),'fixture-only');
  SELECT provider_batch_id INTO batch FROM public.complete_swell_watch_provider_run_receipt(revision);
  FOREACH mode IN ARRAY ARRAY['active','revoked','expired','future'] LOOP
    authority := gen_random_uuid();
    start_at := now()+CASE mode WHEN 'future' THEN interval '1 hour' ELSE interval '-2 hours' END;
    end_at := now()+CASE mode WHEN 'expired' THEN interval '-1 hour' ELSE interval '2 hours' END;
    INSERT INTO public.swell_watch_production_approval_authority
      (record_id,authority_id,authority_epoch,state,policy_hash,policy_provenance,policy_values,approval_id,
       approval_evidence_hash,production_scope,reviewer,not_before,expires_at)
      SELECT gen_random_uuid(),authority,coalesce(max(authority_epoch),0)+1,'active',repeat('e',64),'production_approved',
        values_json,'fixture',repeat('f',64),'swell_watch_push','fixture-only',start_at,end_at
      FROM public.swell_watch_production_approval_authority;
    IF mode='revoked' THEN
      INSERT INTO public.swell_watch_production_approval_authority
        (record_id,authority_id,authority_epoch,state,revokes_authority_id,policy_hash,policy_provenance,policy_values,
         approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at)
        SELECT gen_random_uuid(),gen_random_uuid(),max(authority_epoch)+1,'revoked',authority,repeat('e',64),'production_approved',
          values_json,'fixture',repeat('f',64),'swell_watch_push','fixture-only',start_at,end_at
        FROM public.swell_watch_production_approval_authority;
    END IF;
    IF mode='active' THEN
      PERFORM public.record_swell_watch_shadow_demand(batch,repeat('e',64),'[]'::jsonb);
    ELSE
      BEGIN
        PERFORM public.record_swell_watch_shadow_demand(batch,repeat('e',64),'[]'::jsonb);
        RAISE EXCEPTION 'invalid fallback authority allowed shadow demand';
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'current shadow policy and provider evidence required' THEN RAISE; END IF;
      END;
    END IF;
    IF (SELECT count(*) FROM public.swell_watch_shadow_demand_runs) <> 1 THEN RAISE EXCEPTION 'fallback changed ledger'; END IF;
  END LOOP;
END $$;
ROLLBACK;

BEGIN;
SELECT set_config('app.swell_watch_internal_write','on',true);
INSERT INTO public.swell_watch_production_approval_authority
  (record_id,authority_id,authority_epoch,state,policy_hash,policy_provenance,policy_values,
   approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at)
VALUES(gen_random_uuid(),gen_random_uuid(),1,'active',repeat('e',64),'production_approved',:'policy_values'::jsonb,
  'fallback-fixture',repeat('f',64),'swell_watch_push','fixture-only',now()-interval '1 hour',now()+interval '1 hour');
DO $$ BEGIN
  IF (SELECT policy_hash FROM public.swell_watch_get_matching_policy()) IS DISTINCT FROM repeat('e',64) THEN
    RAISE EXCEPTION 'legacy policy fallback failed';
  END IF;
END $$;
INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
VALUES(1,'active',repeat('a',64),:'policy_values'::jsonb,'fixture-only',repeat('b',64),now()-interval '1 hour',now()+interval '1 hour');
DO $$ BEGIN
  IF (SELECT policy_hash FROM public.swell_watch_get_matching_policy()) IS DISTINCT FROM repeat('a',64) THEN
    RAISE EXCEPTION 'evaluation policy did not take precedence';
  END IF;
  INSERT INTO public.swell_watch_evaluation_policies
    SELECT 2,'revoked',policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at,clock_timestamp()
    FROM public.swell_watch_evaluation_policies WHERE epoch=1;
  IF EXISTS(SELECT 1 FROM public.swell_watch_get_matching_policy()) THEN RAISE EXCEPTION 'revoked policy used push fallback'; END IF;
  INSERT INTO public.swell_watch_evaluation_policies
    SELECT 3,'active',policy_hash,policy_values,reviewer,evidence_hash,now()-interval '2 hours',now()-interval '1 hour',clock_timestamp()
    FROM public.swell_watch_evaluation_policies WHERE epoch=1;
  IF EXISTS(SELECT 1 FROM public.swell_watch_get_matching_policy()) THEN RAISE EXCEPTION 'expired policy used push fallback'; END IF;
  INSERT INTO public.swell_watch_evaluation_policies
    SELECT 4,'active',policy_hash,policy_values,reviewer,evidence_hash,now()+interval '1 hour',now()+interval '2 hours',clock_timestamp()
    FROM public.swell_watch_evaluation_policies WHERE epoch=1;
  IF EXISTS(SELECT 1 FROM public.swell_watch_get_matching_policy()) THEN RAISE EXCEPTION 'future policy used push fallback'; END IF;
END $$;
ROLLBACK;
