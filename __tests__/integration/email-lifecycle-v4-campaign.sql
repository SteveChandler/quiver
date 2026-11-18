\set ON_ERROR_STOP on
-- The v4 row is inserted approved, but the live campaign does not move until the separate switch.
CREATE TEMP TABLE v4_before AS SELECT automation_campaign FROM public.email_contact_controls WHERE singleton;
\ir ../../supabase/migrations/20261117130000_startup_lifecycle_v4_campaign.sql
\ir ../../supabase/migrations/20261117130000_startup_lifecycle_v4_campaign.sql
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.email_campaigns WHERE id='startup-lifecycle-v4' AND version=4 AND status='approved'
    AND content_hash='a4025b67cf2cd848cddfc7023a3812979a8968d0cf4651f28527991824fcb675' AND expires_at>now())=1,'v4 row missing or not approved';
  ASSERT (SELECT automation_campaign FROM public.email_contact_controls WHERE singleton) IS NOT DISTINCT FROM (SELECT automation_campaign FROM v4_before),
    'the v4 migration switched the live campaign by itself';
  ASSERT NOT EXISTS (SELECT 1 FROM public.email_contact_state WHERE approved_campaign='startup-lifecycle-v4'),'contacts moved without the switch';
END $$;

-- The documented switch moves every eligible contact and the cohort to v4.
BEGIN;
UPDATE public.email_contact_controls SET automation_campaign='startup-lifecycle-v4' WHERE singleton;
DO $$ DECLARE moved integer; BEGIN
  LOOP moved := public.refresh_lifecycle_enrollment(); EXIT WHEN moved = 0; END LOOP;
  ASSERT (SELECT count(*) FROM public.email_contact_state WHERE approved_campaign='startup-lifecycle-v4')>0,'no contact moved to v4';
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(public.email_lifecycle_cohort()) u
    JOIN public.email_contact_state s ON s.user_id = u::uuid WHERE s.approved_campaign IS DISTINCT FROM 'startup-lifecycle-v4') THEN
    RAISE EXCEPTION 'cohort returned a contact outside v4'; END IF;
END $$;
ROLLBACK;
DROP TABLE v4_before;
