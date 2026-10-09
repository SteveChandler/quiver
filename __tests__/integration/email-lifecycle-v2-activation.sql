-- The full-audience fixture rolls back its 123 aaaa0000 contacts, so seed one eligible v1 contact here.
INSERT INTO auth.users(id,email,created_at)
VALUES ('eeee0000-0000-4000-8000-000000000001','v2-rebind@example.com',now()-interval '5 days');
INSERT INTO public.profiles(id,email,analytics_is_real_user,notif_email_enabled)
VALUES ('eeee0000-0000-4000-8000-000000000001','v2-rebind@example.com',true,true);
INSERT INTO public.email_contact_state(user_id,approved_campaign,lifecycle_consent_at,consent_reference,history_reviewed_at)
VALUES ('eeee0000-0000-4000-8000-000000000001','startup-lifecycle-v1',now(),'fixture consent',now());
UPDATE public.email_contact_controls
SET history_cutover_at=now()-interval '1 day', history_cutover_reference='fixture reviewed history'
WHERE singleton;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.email_contact_state
    WHERE user_id='eeee0000-0000-4000-8000-000000000001' AND approved_campaign='startup-lifecycle-v1')=1;
END $$;
\ir ../../supabase/migrations/20261007030000_activate_startup_lifecycle_v2.sql

-- After 20261007030000: automation runs v2, every eligible contact moved, and the cohort reads v2 only.
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.email_contact_state
    WHERE user_id='eeee0000-0000-4000-8000-000000000001' AND approved_campaign='startup-lifecycle-v2')>0,
    'eligible v1 contact did not move to v2';
  ASSERT (SELECT count(*) FROM public.email_contact_state
    WHERE user_id='eeee0000-0000-4000-8000-000000000001' AND approved_campaign='startup-lifecycle-v1')=0,
    'eligible contact is still on v1';
  IF (SELECT automation_campaign FROM public.email_contact_controls WHERE singleton) IS DISTINCT FROM 'startup-lifecycle-v2' THEN
    RAISE EXCEPTION 'automation campaign was not moved to v2'; END IF;
  IF public.refresh_lifecycle_enrollment() <> 0 THEN
    RAISE EXCEPTION 'eligible contacts were left on the old campaign'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(public.email_lifecycle_cohort()) u
    JOIN public.email_contact_state s ON s.user_id = u::uuid WHERE s.approved_campaign IS DISTINCT FROM 'startup-lifecycle-v2') THEN
    RAISE EXCEPTION 'cohort returned a contact outside the automation campaign'; END IF;
END $$;
