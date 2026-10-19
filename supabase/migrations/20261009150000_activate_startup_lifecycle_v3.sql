-- Activate lifecycle campaign v3 for the Steve voice copy rewrite.
-- Approved campaigns are frozen (freeze_email_campaign), so v2 from 20261007030000 cannot take the new hash.
-- content_hash = LIFECYCLE_CONTENT_HASH with TRIAL_FEEDBACK_ENABLED=true (pinned by
-- __tests__/lib/mailer/lifecycle-email.test.tsx). Apply only after this copy is live on prod, or claims
-- fail with version_mismatch. Attempt uniqueness on (user, job, episode) keeps earlier stages from resending.
-- Rollback: UPDATE email_contact_controls SET automation_campaign='startup-lifecycle-v2' WHERE singleton,
-- then rerun refresh_lifecycle_enrollment() until it returns 0, together with reverting the app constants.
BEGIN;

INSERT INTO public.email_campaigns(id, version, content_hash, status, owner, approved_by, approved_at, expires_at)
VALUES ('startup-lifecycle-v3', 3, 'c4420192008baef0a920860820092f5e13e00788833963112bc2634c929fbde2',
  'approved', 'Steven', 'steven:approved-v3-content:20261009', now(), now() + interval '90 days')
ON CONFLICT (id) DO NOTHING;

UPDATE public.email_contact_controls SET automation_campaign = 'startup-lifecycle-v3' WHERE singleton;

DO $$
DECLARE moved integer;
BEGIN
  LOOP
    moved := public.refresh_lifecycle_enrollment();
    EXIT WHEN moved = 0;
  END LOOP;
  RAISE NOTICE 'Lifecycle contacts on v3: %',
    (SELECT count(*) FROM public.email_contact_state WHERE approved_campaign = 'startup-lifecycle-v3');
END $$;

COMMIT;
