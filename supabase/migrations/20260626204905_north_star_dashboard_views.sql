-- Free-growth north-star dashboard (plan 046). 4 read-only views over user_events.session_created.
-- security_invoker=true (respect caller RLS) + revoked from anon/authenticated; only service_role reads.
-- Bot/internal exclusion predicate is the canonical one from docs/free-growth/north-star.md.

BEGIN;

-- 1. Daily logged sessions (trailing 180d), by source
CREATE OR REPLACE VIEW public.nsm_daily_logged_sessions
WITH (security_invoker = true) AS
WITH eligible AS (
  SELECT date_trunc('day', ue.created_at)::date AS day,
         COALESCE(NULLIF(ue.metadata->>'source', ''), 'unknown') AS source
  FROM public.user_events ue
  JOIN public.profiles p ON p.id = ue.user_id
  WHERE ue.event_type = 'session_created'
    AND ue.created_at >= now() - interval '180 days'
    AND ue.user_id IS NOT NULL
    AND COALESCE(ue.bot_flagged, false) = false
    AND p.deleted_at IS NULL
    AND COALESCE(p.is_mock, false) = false
    AND COALESCE(p.is_system_account, false) = false
    AND p.analytics_is_real_user = true
    AND lower(COALESCE(ue.metadata->>'is_mock', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'mock', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'is_system_account', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'system', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'analytics_is_real_user', 'true')) <> 'false'
)
SELECT day, source, count(*)::bigint AS logged_sessions
FROM eligible GROUP BY day, source;

-- 2. Activation: first-session users / new real users, by signup day + source (trailing 180d)
CREATE OR REPLACE VIEW public.nsm_activation
WITH (security_invoker = true) AS
WITH eligible AS (
  SELECT ue.user_id, ue.created_at,
         COALESCE(NULLIF(ue.metadata->>'source', ''), 'unknown') AS source,
         lower(COALESCE(ue.metadata->>'is_first_session', 'false')) = 'true' AS is_first_session
  FROM public.user_events ue
  JOIN public.profiles p ON p.id = ue.user_id
  WHERE ue.event_type = 'session_created'
    AND ue.created_at >= now() - interval '180 days'
    AND ue.user_id IS NOT NULL
    AND COALESCE(ue.bot_flagged, false) = false
    AND p.deleted_at IS NULL
    AND COALESCE(p.is_mock, false) = false
    AND COALESCE(p.is_system_account, false) = false
    AND p.analytics_is_real_user = true
    AND lower(COALESCE(ue.metadata->>'is_mock', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'mock', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'is_system_account', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'system', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'analytics_is_real_user', 'true')) <> 'false'
),
first_sessions_by_day AS (
  SELECT date_trunc('day', created_at)::date AS day, source,
         count(DISTINCT user_id)::bigint AS first_session_users
  FROM eligible WHERE is_first_session GROUP BY day, source
),
new_users_by_day AS (
  SELECT date_trunc('day', p.created_at)::date AS day, count(*)::bigint AS new_users
  FROM public.profiles p
  WHERE p.created_at >= now() - interval '180 days'
    AND p.deleted_at IS NULL
    AND COALESCE(p.is_mock, false) = false
    AND COALESCE(p.is_system_account, false) = false
    AND p.analytics_is_real_user = true
  GROUP BY day
)
SELECT fs.day, fs.source, fs.first_session_users,
       COALESCE(nu.new_users, 0)::bigint AS new_users,
       CASE WHEN COALESCE(nu.new_users, 0) = 0 THEN NULL
            ELSE round(fs.first_session_users::numeric / nu.new_users::numeric, 4) END AS activation_rate
FROM first_sessions_by_day fs
LEFT JOIN new_users_by_day nu ON nu.day = fs.day;

-- 3. Repeat >=3 sessions in rolling 21d, by day + latest source (trailing 120d)
CREATE OR REPLACE VIEW public.nsm_repeat_3plus_21d
WITH (security_invoker = true) AS
WITH days AS (
  SELECT generate_series(
    date_trunc('day', now() - interval '120 days'),
    date_trunc('day', now()),
    interval '1 day'
  ) AS day
),
eligible AS (
  SELECT ue.user_id, ue.created_at,
         COALESCE(NULLIF(ue.metadata->>'source', ''), 'unknown') AS source
  FROM public.user_events ue
  JOIN public.profiles p ON p.id = ue.user_id
  WHERE ue.event_type = 'session_created'
    AND ue.created_at >= now() - interval '140 days'
    AND ue.user_id IS NOT NULL
    AND COALESCE(ue.bot_flagged, false) = false
    AND p.deleted_at IS NULL
    AND COALESCE(p.is_mock, false) = false
    AND COALESCE(p.is_system_account, false) = false
    AND p.analytics_is_real_user = true
    AND lower(COALESCE(ue.metadata->>'is_mock', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'mock', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'is_system_account', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'system', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'analytics_is_real_user', 'true')) <> 'false'
),
repeat_users AS (
  SELECT d.day::date AS day, e.user_id,
         (array_agg(e.source ORDER BY e.created_at DESC))[1] AS source,
         count(*)::bigint AS sessions_in_21d
  FROM days d
  JOIN eligible e ON e.created_at >= d.day - interval '20 days'
                 AND e.created_at < d.day + interval '1 day'
  GROUP BY d.day, e.user_id
  HAVING count(*) >= 3
)
SELECT day, source, count(*)::bigint AS repeat_users_3plus_21d
FROM repeat_users GROUP BY day, source;

-- 4. Time-to-first-session: median + p75 hours signup->first session, by signup day + source (trailing 180d)
CREATE OR REPLACE VIEW public.nsm_time_to_first_session
WITH (security_invoker = true) AS
WITH eligible AS (
  SELECT ue.user_id, ue.created_at,
         COALESCE(NULLIF(ue.metadata->>'source', ''), 'unknown') AS source
  FROM public.user_events ue
  JOIN public.profiles p ON p.id = ue.user_id
  WHERE ue.event_type = 'session_created'
    AND ue.user_id IS NOT NULL
    AND COALESCE(ue.bot_flagged, false) = false
    AND p.deleted_at IS NULL
    AND COALESCE(p.is_mock, false) = false
    AND COALESCE(p.is_system_account, false) = false
    AND p.analytics_is_real_user = true
    AND lower(COALESCE(ue.metadata->>'is_mock', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'mock', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'is_system_account', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'system', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'analytics_is_real_user', 'true')) <> 'false'
),
first_session AS (
  SELECT DISTINCT ON (user_id) user_id, created_at AS first_session_at, source
  FROM eligible ORDER BY user_id, created_at ASC
),
activated_users AS (
  SELECT date_trunc('day', p.created_at)::date AS signup_day, fs.source,
         extract(epoch FROM (fs.first_session_at - p.created_at)) / 3600.0 AS hours_to_first_session
  FROM public.profiles p
  JOIN first_session fs ON fs.user_id = p.id
  WHERE p.created_at >= now() - interval '180 days'
    AND p.deleted_at IS NULL
    AND COALESCE(p.is_mock, false) = false
    AND COALESCE(p.is_system_account, false) = false
    AND p.analytics_is_real_user = true
    AND fs.first_session_at >= p.created_at
)
SELECT signup_day, source, count(*)::bigint AS activated_users,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY hours_to_first_session))::numeric, 2) AS median_hours_to_first_session,
       round((percentile_cont(0.75) WITHIN GROUP (ORDER BY hours_to_first_session))::numeric, 2) AS p75_hours_to_first_session
FROM activated_users GROUP BY signup_day, source;

-- Lock down: dashboard automation uses service_role; never expose aggregates to anon/authenticated.
REVOKE ALL ON public.nsm_daily_logged_sessions, public.nsm_activation,
                 public.nsm_repeat_3plus_21d, public.nsm_time_to_first_session
  FROM anon, authenticated;
GRANT SELECT ON public.nsm_daily_logged_sessions, public.nsm_activation,
                 public.nsm_repeat_3plus_21d, public.nsm_time_to_first_session
  TO service_role;

COMMIT;
