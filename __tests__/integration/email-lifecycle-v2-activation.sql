-- After 20261007030000: automation runs v2, every eligible contact moved, and the cohort reads v2 only.
DO $$ BEGIN
  IF (SELECT automation_campaign FROM public.email_contact_controls WHERE singleton) IS DISTINCT FROM 'startup-lifecycle-v2' THEN
    RAISE EXCEPTION 'automation campaign was not moved to v2'; END IF;
  IF public.refresh_lifecycle_enrollment() <> 0 THEN
    RAISE EXCEPTION 'eligible contacts were left on the old campaign'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(public.email_lifecycle_cohort()) u
    JOIN public.email_contact_state s ON s.user_id = u::uuid WHERE s.approved_campaign IS DISTINCT FROM 'startup-lifecycle-v2') THEN
    RAISE EXCEPTION 'cohort returned a contact outside the automation campaign'; END IF;
END $$;
