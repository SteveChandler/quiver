\set ON_ERROR_STOP on
-- Runs after two runs of 20261124161000_lifecycle_disable_friction_routine.sql.
DO $$ BEGIN
 ASSERT (SELECT disabled_jobs FROM email_contact_controls WHERE singleton)='{friction,routine}'::text[];
 ASSERT (SELECT welcome_relay_only FROM email_contact_controls WHERE singleton);
 ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.evaluate_email_lifecycle(uuid,uuid)'::regprocedure);
 ASSERT (SELECT proconfig FROM pg_proc WHERE oid='public.evaluate_email_lifecycle(uuid,uuid)'::regprocedure)='{"search_path=public, pg_temp"}';
 ASSERT has_function_privilege('service_role','public.evaluate_email_lifecycle(uuid,uuid)','EXECUTE');
 ASSERT NOT has_function_privilege('anon','public.evaluate_email_lifecycle(uuid,uuid)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.evaluate_email_lifecycle(uuid,uuid)','EXECUTE');
END $$;

BEGIN;
DO $$
DECLARE
 fr uuid := 'c0c00000-0000-4000-8000-000000000001';
 ro uuid := 'c0c00000-0000-4000-8000-000000000002';
 we uuid := 'c0c00000-0000-4000-8000-000000000003';
 re uuid := 'c0c00000-0000-4000-8000-000000000004';
 ac uuid := 'c0c00000-0000-4000-8000-000000000005';
 pr uuid := 'c0c00000-0000-4000-8000-000000000006';
 tz text := 'America/Los_Angeles';
 d jsonb;
BEGIN
 UPDATE email_contact_controls SET enabled=true,lifecycle_enabled=true,daily_cap=NULL WHERE singleton;
 INSERT INTO auth.users(id,email,created_at,email_confirmed_at) VALUES
  (fr,'trim-friction@example.com',now()-interval '8 days',now()-interval '8 days'),
  (ro,'trim-routine@example.com',now()-interval '22 days',now()-interval '22 days'),
  (we,'trim-welcome@gmail.com',now()-interval '2 hours',now()-interval '2 hours'),
  (re,'abc123xyz@privaterelay.appleid.com',now()-interval '2 hours',now()-interval '2 hours'),
  (ac,'trim-activation@example.com',now()-interval '4 days',now()-interval '4 days'),
  (pr,'trim-progress@example.com',now()-interval '8 days',now()-interval '8 days');
 INSERT INTO profiles(id,email,analytics_is_real_user,notif_email_enabled,timezone,home_beach_id) VALUES
  (fr,'trim-friction@example.com',true,true,tz,NULL),(ro,'trim-routine@example.com',true,true,tz,NULL),
  (we,'trim-welcome@gmail.com',true,true,tz,NULL),(re,'ABC123xyz@privaterelay.appleid.com',true,true,tz,NULL),
  (ac,'trim-activation@example.com',true,true,tz,NULL),(pr,'trim-progress@example.com',true,true,tz,NULL);
 INSERT INTO email_contact_state(user_id,approved_campaign,lifecycle_consent_at,consent_reference,history_reviewed_at,
  entitlement_verified_until,entitlement_reference,provider_access_active)
 SELECT id,'startup-lifecycle-v1',now(),'trim fixture',now(),now()+interval '1 hour','fixture',false FROM unnest(ARRAY[fr,ro,we,re,ac,pr]) id;
 INSERT INTO user_entitlements(user_id,is_pro,is_trialing) SELECT id,false,false FROM unnest(ARRAY[fr,ro,we,re,ac,pr]) id;
 INSERT INTO user_events(user_id,bot_flagged,event_type,created_at) VALUES
  (fr,false,'beach_view',now()-interval '5 days'),
  (ro,false,'beach_view',now()-interval '1 day'),(ro,false,'beach_view',now()-interval '3 days'),
  (ac,false,'beach_view',now()-interval '1 day');
 -- pr matches friction and progress: 2 sessions, last use and last completion 5 days ago.
 -- The sessions trigger stamps email_completed_at with now(); skip it so the completion is 5 days old.
 PERFORM set_config('session_replication_role','replica',true);
 INSERT INTO sessions(user_id,status,email_completed_at) VALUES (pr,'completed',now()-interval '6 days'),(pr,'completed',now()-interval '5 days');
 PERFORM set_config('session_replication_role','origin',true);

 -- Stopped stage jobs: skipped, never due, and the claim refuses them.
 d := evaluate_email_lifecycle(fr);
 ASSERT d->>'status'='quiet' AND d->>'reason'='no_relevant_job',d::text;
 d := evaluate_email_lifecycle(ro);
 ASSERT d->>'status'='quiet' AND d->>'reason'='no_relevant_job',d::text;
 PERFORM record_email_lifecycle_decision(fr); PERFORM record_email_lifecycle_decision(ro);
 ASSERT (SELECT count(*) FROM email_lifecycle_recipients WHERE user_id IN (fr,ro) AND status='quiet' AND reason='no_relevant_job' AND first_due_at IS NULL)=2;
 ASSERT claim_email_lifecycle(fr,1,repeat('a',64))->>'reason'='no_relevant_job';
 -- A stopped friction job does not hold the slot: the user who also matches progress gets progress.
 d := evaluate_email_lifecycle(pr);
 ASSERT d->>'job'='progress' AND d->>'status' IN ('due','deferred'),d::text;
 ASSERT NOT EXISTS (SELECT 1 FROM email_contact_attempts WHERE user_id IN (fr,ro));

 -- Welcome: a relay address keeps the campaign welcome; any other address is left to the founder's Gmail welcome.
 d := evaluate_email_lifecycle(re);
 ASSERT d->>'job'='welcome' AND d->>'status' IN ('due','deferred'),d::text;
 d := evaluate_email_lifecycle(we);
 ASSERT d->>'status'='quiet' AND d->>'reason'='founder_welcome' AND d->>'job'='welcome',d::text;
 PERFORM record_email_lifecycle_decision(we);
 ASSERT (SELECT status FROM email_lifecycle_recipients WHERE user_id=we)='quiet';

 -- Other jobs are unchanged.
 d := evaluate_email_lifecycle(ac);
 ASSERT d->>'job'='activation' AND d->>'status' IN ('due','deferred'),d::text;

 -- The off switch is one UPDATE.
 UPDATE email_contact_controls SET disabled_jobs='{}', welcome_relay_only=false WHERE singleton;
 d := evaluate_email_lifecycle(fr);
 ASSERT d->>'job'='friction' AND d->>'status' IN ('due','deferred'),d::text;
 d := evaluate_email_lifecycle(ro);
 ASSERT d->>'job'='routine' AND d->>'status' IN ('due','deferred'),d::text;
 d := evaluate_email_lifecycle(pr);
 ASSERT d->>'job'='friction',d::text;
 d := evaluate_email_lifecycle(we);
 ASSERT d->>'job'='welcome' AND d->>'status' IN ('due','deferred'),d::text;
 d := evaluate_email_lifecycle(re);
 ASSERT d->>'job'='welcome' AND d->>'status' IN ('due','deferred'),d::text;
 d := evaluate_email_lifecycle(ac);
 ASSERT d->>'job'='activation' AND d->>'status' IN ('due','deferred'),d::text;

 -- Each setting works alone.
 UPDATE email_contact_controls SET disabled_jobs='{routine}' WHERE singleton;
 ASSERT evaluate_email_lifecycle(fr)->>'job'='friction';
 ASSERT evaluate_email_lifecycle(ro)->>'reason'='no_relevant_job';
 ASSERT evaluate_email_lifecycle(we)->>'job'='welcome';

 BEGIN
  UPDATE email_contact_controls SET disabled_jobs='{fricton}' WHERE singleton;
  RAISE EXCEPTION 'unknown job name was accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;
ROLLBACK;
