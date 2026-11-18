-- Add the approved lifecycle campaign v4 (forecast-first activation email, idea 4). Insert only.
-- This migration does NOT switch email_contact_controls.automation_campaign; v3 stays live.
-- content_hash = LIFECYCLE_CONTENT_HASH with TRIAL_FEEDBACK_ENABLED=true and LIFECYCLE_V4_ENABLED=true
-- (pinned by __tests__/lib/mailer/lifecycle-email-v4.test.tsx). With LIFECYCLE_V4_ENABLED unset the
-- app keeps the v3 hash, so this row has no effect until the switch in the PR notes is done.
-- Rollback: DELETE FROM public.email_campaigns WHERE id='startup-lifecycle-v4'
--   AND NOT EXISTS (SELECT 1 FROM public.email_contact_state WHERE approved_campaign='startup-lifecycle-v4')
--   AND (SELECT automation_campaign FROM public.email_contact_controls WHERE singleton) IS DISTINCT FROM 'startup-lifecycle-v4';
BEGIN;

INSERT INTO public.email_campaigns(id, version, content_hash, status, owner, approved_by, approved_at, expires_at)
VALUES ('startup-lifecycle-v4', 4, '2cd7425ed6087cc2396653d96a7c5d39566033015a6c059e685c69836e3f1f2b',
  'approved', 'Steven', 'steven:approved-return-loop-mock-v4:20261117', now(), now() + interval '90 days')
ON CONFLICT (id) DO NOTHING;

COMMIT;
