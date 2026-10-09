-- Activate lifecycle campaign v2, per docs/implementation/trial-feedback.md step 5.
-- Prod has run TRIAL_FEEDBACK_ENABLED=true since 2026-09-30, so the app claims v2 (version 2) while
-- contacts and the cohort stayed bound to v1: every claim returned version_mismatch and no lifecycle
-- email was accepted after 2026-09-29. v1 is frozen, so v2 is a new approved row.
-- content_hash = LIFECYCLE_CONTENT_HASH with TRIAL_FEEDBACK_ENABLED=true for the rewritten copy in this
-- change (pinned by __tests__/lib/mailer/lifecycle-email.test.tsx). Apply only after that copy is live
-- on prod, or claims keep failing with version_mismatch. Existing (user, job, episode) attempt uniqueness
-- keeps v1 stages from resending under v2.
-- The loop runs until refresh_lifecycle_enrollment() returns 0, also completing pending first-time enrollment in one transaction; check email_contact_controls.daily_cap if a send burst matters.
-- Rollback: with TRIAL_FEEDBACK_ENABLED unset the app hash matches neither v1 nor v2, stopping lifecycle sends; revert the code plus flag as described in the PR.
BEGIN;

INSERT INTO public.email_campaigns(id, version, content_hash, status, owner, approved_by, approved_at, expires_at)
VALUES ('startup-lifecycle-v2', 2, '172803d87d8ee9a7be33bd03bd9cbfe71a069de81f74cc320894dd32cd1aedb1',
  'approved', 'Steven', 'steven:approved-v2-content:20261009', now(), now() + interval '90 days')
ON CONFLICT (id) DO NOTHING;

UPDATE public.email_contact_controls SET automation_campaign = 'startup-lifecycle-v2' WHERE singleton;

-- Select contacts bound to whichever campaign automation runs, instead of a hardcoded version.
CREATE OR REPLACE FUNCTION public.email_lifecycle_cohort() RETURNS jsonb LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(user_id),'[]'::jsonb) FROM (
  SELECT s.user_id FROM public.email_contact_state s
  JOIN public.email_contact_controls c ON c.singleton AND s.approved_campaign=c.automation_campaign
  LEFT JOIN public.email_lifecycle_recipients r ON r.user_id=s.user_id
  ORDER BY coalesce(r.status='due' AND r.first_due_at<now()-interval '30 minutes'
    AND r.evaluated_at<now()-interval '30 minutes' AND NOT EXISTS(
    SELECT 1 FROM public.email_contact_attempts a
    WHERE a.user_id=r.user_id AND a.lifecycle_job=r.job AND a.episode=r.episode
      AND a.state NOT IN ('cancelled','failed')
  ), false) DESC, r.evaluated_at NULLS FIRST, s.user_id
  LIMIT 50
 ) cohort;
$$;

-- Rebind every eligible v1 contact now instead of 50 per hourly run.
DO $$
DECLARE moved integer;
BEGIN
  LOOP
    moved := public.refresh_lifecycle_enrollment();
    EXIT WHEN moved = 0;
  END LOOP;
  RAISE NOTICE 'Lifecycle contacts: % on v2, % still on v1',
    (SELECT count(*) FROM public.email_contact_state WHERE approved_campaign = 'startup-lifecycle-v2'),
    (SELECT count(*) FROM public.email_contact_state WHERE approved_campaign = 'startup-lifecycle-v1');
END $$;

COMMIT;
