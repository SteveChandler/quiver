BEGIN;

-- Return only the evaluator's early holds. Later checks still run per user.
CREATE OR REPLACE FUNCTION public.precheck_email_lifecycle(p_user_ids uuid[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  WITH cohort AS (
    SELECT DISTINCT user_id
    FROM unnest(p_user_ids) AS ids(user_id)
    WHERE cardinality(p_user_ids) <= 50
  ), email_counts AS (
    SELECT lower(trim(p.email)) AS email, count(*) AS matches
    FROM public.profiles p
    WHERE lower(trim(p.email)) IN (
      SELECT lower(trim(candidate.email)) FROM cohort
      JOIN public.profiles candidate ON candidate.id = cohort.user_id
    )
    GROUP BY lower(trim(p.email))
  ), evaluated AS (
    SELECT cohort.user_id, c.id AS campaign_id, CASE
      WHEN p.deleted_at IS NOT NULL OR u.created_at IS NULL
        OR p.analytics_is_real_user IS DISTINCT FROM true OR p.notif_email_enabled IS DISTINCT FROM true
        THEN 'ineligible_profile'
      WHEN coalesce(email_counts.matches, 0) <> 1 THEN 'ambiguous_identity'
      WHEN EXISTS (SELECT 1 FROM public.email_suppression_list WHERE lower(trim(email)) = lower(trim(p.email)))
        OR EXISTS (SELECT 1 FROM public.user_email_prefs WHERE user_id = cohort.user_id AND email_frequency = 'off')
        THEN 'suppressed'
      WHEN s.paused_at IS NOT NULL THEN 'reply_paused'
      WHEN NOT public.lifecycle_permission_verified(s)
        OR s.history_reviewed_at IS NULL OR s.history_reviewed_at > now() THEN 'consent_or_history_unknown'
      WHEN s.entitlement_verified_until IS NULL OR s.entitlement_verified_until <= now()
        OR s.entitlement_verified_until > now() + interval '24 hours'
        OR nullif(trim(s.entitlement_reference), '') IS NULL THEN 'entitlement_review_stale'
      WHEN c.id IS NULL OR c.status <> 'approved' OR c.approved_at > now() OR c.expires_at <= now()
        THEN 'campaign_unapproved'
    END AS reason
    FROM cohort
    LEFT JOIN public.profiles p ON p.id = cohort.user_id
    LEFT JOIN auth.users u ON u.id = cohort.user_id AND u.email_confirmed_at IS NOT NULL
      AND lower(trim(u.email)) = lower(trim(p.email))
    LEFT JOIN email_counts ON email_counts.email = lower(trim(p.email))
    LEFT JOIN public.email_contact_state s ON s.user_id = cohort.user_id
    LEFT JOIN public.email_campaigns c ON c.id = s.approved_campaign
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'user_id', user_id, 'campaign_id', campaign_id, 'status', 'held', 'reason', reason
  )), '[]'::jsonb)
  FROM evaluated WHERE reason IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.precheck_email_lifecycle(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.precheck_email_lifecycle(uuid[]) TO service_role;

COMMIT;
