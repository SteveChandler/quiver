BEGIN;

CREATE OR REPLACE VIEW public.public_session_feed_eligibility
WITH (security_invoker = true) AS
WITH classified AS (
  SELECT
    s.id AS session_id,
    s.user_id,
    s.beach_id,
    s.arrival_time,
    s.created_at,
    (
      length(btrim(coalesce(s.notes, ''))) >= 12
      OR (
        s.source IS DISTINCT FROM 'auto_title'
        AND length(btrim(coalesce(s.description, ''))) >= 12
      )
      OR s.wave_quality IS NOT NULL
      OR coalesce(array_length(s.wave_characteristics, 1), 0) > 0
      OR s.tide_height_ft IS NOT NULL
      OR s.tide_status IS NOT NULL
      OR s.tide_rate_ft_per_hr IS NOT NULL
      OR s.rip_current_observed IS NOT NULL
      OR s.rip_current_risk IS NOT NULL
      OR s.crowd_level IS NOT NULL
      OR s.water_temp IS NOT NULL
    ) AS has_context,
    (
      nullif(btrim(coalesce(s.image_url, '')), '') IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM public.session_media sm
        WHERE sm.session_id = s.id
          AND sm.deleted_at IS NULL
      )
    ) AS has_media,
    s.rating
  FROM public.sessions s
  WHERE s.status = 'completed'
    AND s.is_public = true
    AND s.deleted_at IS NULL
)
SELECT
  session_id,
  user_id,
  beach_id,
  arrival_time,
  created_at,
  has_context,
  has_media,
  (NOT has_context AND NOT has_media) AS thin,
  (rating IS NOT NULL AND rating <= 2 AND (has_context OR has_media)) AS warning,
  (has_context OR has_media) AS informative,
  (rating IS NOT NULL AND rating >= 4 AND (has_context OR has_media)) AS strong
FROM classified;

COMMENT ON VIEW public.public_session_feed_eligibility IS
'One row per public, completed, non-deleted session with feed quality flags used by /api/sessions/public.';

GRANT SELECT ON public.public_session_feed_eligibility TO anon, authenticated;

CREATE OR REPLACE VIEW public.session_activation_report
WITH (security_invoker = true) AS
WITH real_users AS (
  SELECT
    p.id AS user_id,
    p.created_at AS signup_at
  FROM public.profiles p
  WHERE p.deleted_at IS NULL
    AND coalesce(p.is_mock, false) = false
    AND coalesce(p.is_system_account, false) = false
    AND coalesce(p.is_admin, false) = false
    AND coalesce(p.analytics_is_real_user, true) = true
    AND coalesce(p.email, '') NOT ILIKE '%test%'
    AND coalesce(p.email, '') NOT ILIKE '%@local.test'
    AND coalesce(p.email, '') NOT ILIKE '%@example.invalid'
),
completed_sessions AS (
  SELECT
    s.id AS session_id,
    s.user_id,
    s.beach_id,
    s.created_at,
    s.arrival_time,
    s.is_public,
    row_number() OVER (
      PARTITION BY s.user_id
      ORDER BY s.created_at ASC, s.id ASC
    ) AS session_number
  FROM public.sessions s
  JOIN real_users ru ON ru.user_id = s.user_id
  WHERE s.status = 'completed'
    AND s.deleted_at IS NULL
),
first_sessions AS (
  SELECT
    user_id,
    session_id AS first_session_id,
    created_at AS first_session_at,
    beach_id AS first_session_beach_id
  FROM completed_sessions
  WHERE session_number = 1
),
second_sessions AS (
  SELECT
    cs.user_id,
    cs.session_id AS second_session_within_14d_id,
    cs.created_at AS second_session_within_14d_at
  FROM completed_sessions cs
  JOIN first_sessions fs ON fs.user_id = cs.user_id
  WHERE cs.session_number = 2
    AND cs.created_at < fs.first_session_at + interval '14 days'
),
public_milestones AS (
  SELECT
    e.user_id,
    min(e.created_at) FILTER (WHERE e.informative) AS first_qualified_public_session_at,
    min(e.created_at) FILTER (WHERE e.warning) AS first_warning_session_at,
    min(e.created_at) FILTER (WHERE e.thin) AS first_thin_public_session_at,
    count(*) FILTER (WHERE e.informative)::bigint AS qualified_public_session_count,
    count(*) FILTER (WHERE e.warning)::bigint AS warning_session_count,
    count(*) FILTER (WHERE e.thin)::bigint AS thin_public_session_count
  FROM public.public_session_feed_eligibility e
  GROUP BY e.user_id
),
session_counts AS (
  SELECT
    cs.user_id,
    count(*)::bigint AS completed_session_count,
    count(*) FILTER (WHERE cs.is_public = true)::bigint AS public_session_count
  FROM completed_sessions cs
  GROUP BY cs.user_id
)
SELECT
  ru.user_id,
  ru.signup_at,
  fs.first_session_id,
  fs.first_session_at,
  fs.first_session_beach_id,
  CASE
    WHEN fs.first_session_at IS NULL THEN NULL
    ELSE round((extract(epoch FROM (fs.first_session_at - ru.signup_at)) / 86400.0)::numeric, 2)
  END AS days_to_first_session,
  ss.second_session_within_14d_id,
  ss.second_session_within_14d_at,
  (ss.second_session_within_14d_id IS NOT NULL) AS has_second_session_within_14d,
  pm.first_qualified_public_session_at,
  pm.first_warning_session_at,
  pm.first_thin_public_session_at,
  coalesce(sc.completed_session_count, 0)::bigint AS completed_session_count,
  coalesce(sc.public_session_count, 0)::bigint AS public_session_count,
  coalesce(pm.qualified_public_session_count, 0)::bigint AS qualified_public_session_count,
  coalesce(pm.warning_session_count, 0)::bigint AS warning_session_count,
  coalesce(pm.thin_public_session_count, 0)::bigint AS thin_public_session_count
FROM real_users ru
LEFT JOIN first_sessions fs ON fs.user_id = ru.user_id
LEFT JOIN second_sessions ss ON ss.user_id = ru.user_id
LEFT JOIN public_milestones pm ON pm.user_id = ru.user_id
LEFT JOIN session_counts sc ON sc.user_id = ru.user_id;

COMMENT ON VIEW public.session_activation_report IS
'Activation reporting view using completed, non-deleted sessions as source of truth for first session, repeat within 14 days, and public-session quality milestones.';

REVOKE ALL ON public.session_activation_report FROM anon, authenticated;
GRANT SELECT ON public.session_activation_report TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS user_events_session_created_session_id_uidx
  ON public.user_events ((metadata->>'session_id'))
  WHERE event_type = 'session_created'
    AND metadata ? 'session_id';

INSERT INTO public.user_events (
  user_id,
  event_type,
  beach_id,
  metadata,
  created_at,
  expires_at
)
SELECT
  s.user_id,
  'session_created',
  s.beach_id,
  jsonb_strip_nulls(
    jsonb_build_object(
      'source', coalesce(s.source, 'backfill'),
      'surface', 'sessions',
      'is_first_session', row_number() OVER (
        PARTITION BY s.user_id
        ORDER BY s.created_at ASC, s.id ASC
      ) = 1,
      'spot_type', CASE WHEN s.beach_id IS NULL THEN 'custom' ELSE 'beach' END,
      'user_id', s.user_id,
      'session_id', s.id,
      'backfill', true
    )
  ),
  s.created_at,
  s.created_at + interval '90 days'
FROM public.sessions s
JOIN public.profiles p ON p.id = s.user_id
WHERE s.deleted_at IS NULL
  AND s.status = 'completed'
  AND coalesce(p.is_mock, false) = false
  AND coalesce(p.is_system_account, false) = false
  AND coalesce(p.is_admin, false) = false
  AND coalesce(p.analytics_is_real_user, true) = true
  AND coalesce(p.email, '') NOT ILIKE '%test%'
  AND coalesce(p.email, '') NOT ILIKE '%@local.test'
  AND coalesce(p.email, '') NOT ILIKE '%@example.invalid'
  AND p.deleted_at IS NULL
ON CONFLICT DO NOTHING;

COMMIT;
