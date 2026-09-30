BEGIN;

-- Keep overdue unsent recipients in the bounded worker cohort.
CREATE OR REPLACE FUNCTION public.email_lifecycle_cohort() RETURNS jsonb LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(user_id),'[]'::jsonb) FROM (
  SELECT s.user_id FROM public.email_contact_state s
  LEFT JOIN public.email_lifecycle_recipients r ON r.user_id=s.user_id
  WHERE s.approved_campaign='startup-lifecycle-v1'
  ORDER BY coalesce(r.status='due' AND r.first_due_at<now()-interval '30 minutes'
    AND r.evaluated_at<now()-interval '30 minutes' AND NOT EXISTS(
    SELECT 1 FROM public.email_contact_attempts a
    WHERE a.user_id=r.user_id AND a.lifecycle_job=r.job AND a.episode=r.episode
      AND a.state NOT IN ('cancelled','failed')
  ), false) DESC, r.evaluated_at NULLS FIRST, s.user_id
  LIMIT 50
 ) cohort;
$$;

COMMIT;
