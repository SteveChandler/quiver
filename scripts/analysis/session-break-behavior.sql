-- Read-only Quiver session/break behavior analysis.
--
-- Usage:
--   psql "$POSTGRES_URL_NON_POOLING" \
--     -v start='2025-06-20T00:00:00Z' \
--     -v end='2026-06-20T00:00:00Z' \
--     -v min_sessions='5' \
--     -f scripts/analysis/session-break-behavior.sql
--
-- Safety:
-- - SELECT-only.
-- - Excludes deleted sessions.
-- - Excludes mock/system/deleted profiles when profile rows are present.
-- - Does not select names, emails, avatars, notes, photo URLs, board names, or raw user IDs.

\pset pager off

-- 1. Break-level behavior rollup.
WITH base_sessions AS (
  SELECT
    s.id,
    s.beach_id,
    s.user_id,
    s.status,
    s.arrival_time,
    s.created_at,
    s.board_id,
    s.rating,
    s.wave_height_ft,
    s.wave_quality,
    s.wind_speed_mph,
    s.wind_direction,
    s.tide_height_ft,
    s.tide_status,
    s.forecast_accuracy
  FROM public.sessions s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE s.deleted_at IS NULL
    AND s.beach_id IS NOT NULL
    AND s.created_at >= :'start'::timestamptz
    AND s.created_at < :'end'::timestamptz
    AND COALESCE(p.deleted_at IS NULL, TRUE)
    AND COALESCE(p.is_mock, FALSE) = FALSE
    AND COALESCE(p.analytics_is_real_user, TRUE) = TRUE
    AND COALESCE(p.is_system_account, FALSE) = FALSE
),
session_counts AS (
  SELECT
    beach_id,
    user_id,
    COUNT(*) AS sessions_for_user,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_for_user
  FROM base_sessions
  GROUP BY beach_id, user_id
),
break_rollup AS (
  SELECT
    b.id AS beach_id,
    b.name AS break,
    b.region,
    COUNT(bs.id) AS planned_or_intent_sessions,
    COUNT(bs.id) FILTER (WHERE bs.status = 'completed') AS completed_sessions,
    ROUND(
      COUNT(bs.id) FILTER (WHERE bs.status = 'completed')::numeric
      / NULLIF(COUNT(bs.id), 0),
      3
    ) AS completion_rate,
    COUNT(DISTINCT bs.user_id) AS unique_users,
    COUNT(DISTINCT bs.user_id) FILTER (WHERE sc.sessions_for_user = 1) AS first_time_users,
    COUNT(DISTINCT bs.user_id) FILTER (WHERE sc.sessions_for_user >= 2) AS repeat_users,
    COUNT(DISTINCT bs.user_id) FILTER (WHERE sc.completed_for_user >= 2) AS repeat_completed_session_users,
    ROUND(COUNT(bs.id)::numeric / NULLIF(COUNT(DISTINCT bs.user_id), 0), 2) AS avg_sessions_per_user,
    ROUND(AVG(bs.rating)::numeric, 2) AS avg_session_rating,
    ROUND(AVG(bs.wave_quality)::numeric, 2) AS avg_wave_quality
  FROM base_sessions bs
  JOIN public.beaches b ON b.id = bs.beach_id
  JOIN session_counts sc ON sc.beach_id = bs.beach_id AND sc.user_id = bs.user_id
  GROUP BY b.id, b.name, b.region
)
SELECT
  break,
  planned_or_intent_sessions AS planned,
  completed_sessions AS completed,
  completion_rate,
  unique_users,
  first_time_users,
  repeat_users,
  repeat_completed_session_users,
  avg_sessions_per_user,
  avg_session_rating,
  avg_wave_quality,
  CASE
    WHEN planned_or_intent_sessions < 5 OR completed_sessions < 3 THEN 'sparse'
    WHEN planned_or_intent_sessions < 10 OR completed_sessions < 5 THEN 'low'
    WHEN planned_or_intent_sessions < 20 OR completed_sessions < 10 THEN 'medium'
    ELSE 'high'
  END AS confidence_label
FROM break_rollup
ORDER BY planned_or_intent_sessions DESC, completed_sessions DESC;

-- 2. Completion-rate leaders with a minimum sample floor.
WITH base_sessions AS (
  SELECT s.id, s.beach_id, s.user_id, s.status
  FROM public.sessions s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE s.deleted_at IS NULL
    AND s.beach_id IS NOT NULL
    AND s.created_at >= :'start'::timestamptz
    AND s.created_at < :'end'::timestamptz
    AND COALESCE(p.deleted_at IS NULL, TRUE)
    AND COALESCE(p.is_mock, FALSE) = FALSE
    AND COALESCE(p.analytics_is_real_user, TRUE) = TRUE
    AND COALESCE(p.is_system_account, FALSE) = FALSE
)
SELECT
  b.name AS break,
  COUNT(*) AS planned,
  COUNT(*) FILTER (WHERE bs.status = 'completed') AS completed,
  ROUND(
    COUNT(*) FILTER (WHERE bs.status = 'completed')::numeric
    / NULLIF(COUNT(*), 0),
    3
  ) AS completion_rate,
  COUNT(DISTINCT bs.user_id) AS unique_users
FROM base_sessions bs
JOIN public.beaches b ON b.id = bs.beach_id
GROUP BY b.name
HAVING COUNT(*) >= :min_sessions::int
ORDER BY completion_rate DESC, completed DESC, planned DESC
LIMIT 25;

-- 3. Repeat completed-session behavior by break.
WITH base_sessions AS (
  SELECT s.beach_id, s.user_id, s.status
  FROM public.sessions s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE s.deleted_at IS NULL
    AND s.beach_id IS NOT NULL
    AND s.created_at >= :'start'::timestamptz
    AND s.created_at < :'end'::timestamptz
    AND COALESCE(p.deleted_at IS NULL, TRUE)
    AND COALESCE(p.is_mock, FALSE) = FALSE
    AND COALESCE(p.analytics_is_real_user, TRUE) = TRUE
    AND COALESCE(p.is_system_account, FALSE) = FALSE
),
user_break AS (
  SELECT
    beach_id,
    user_id,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_sessions
  FROM base_sessions
  GROUP BY beach_id, user_id
)
SELECT
  b.name AS break,
  COUNT(*) FILTER (WHERE ub.completed_sessions >= 2) AS repeat_completed_session_users,
  SUM(ub.completed_sessions) AS completed_sessions,
  COUNT(*) AS users_with_any_session
FROM user_break ub
JOIN public.beaches b ON b.id = ub.beach_id
GROUP BY b.name
ORDER BY repeat_completed_session_users DESC, completed_sessions DESC
LIMIT 25;

-- 4. Forecast confidence at completed sessions, using session snapshots when present.
WITH base_sessions AS (
  SELECT s.id, s.beach_id, s.user_id, s.status
  FROM public.sessions s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE s.deleted_at IS NULL
    AND s.beach_id IS NOT NULL
    AND s.created_at >= :'start'::timestamptz
    AND s.created_at < :'end'::timestamptz
    AND COALESCE(p.deleted_at IS NULL, TRUE)
    AND COALESCE(p.is_mock, FALSE) = FALSE
    AND COALESCE(p.analytics_is_real_user, TRUE) = TRUE
    AND COALESCE(p.is_system_account, FALSE) = FALSE
)
SELECT
  b.name AS break,
  COUNT(*) FILTER (WHERE bs.status = 'completed') AS completed,
  COUNT(sfs.session_id) AS snapshot_rows,
  ROUND(AVG(sfs.forecast_confidence_score)::numeric, 2) AS avg_forecast_confidence,
  COUNT(*) FILTER (
    WHERE bs.status = 'completed'
      AND sfs.forecast_confidence_score < 55
  ) AS completed_low_confidence_sessions
FROM base_sessions bs
JOIN public.beaches b ON b.id = bs.beach_id
LEFT JOIN public.session_forecast_snapshots sfs ON sfs.session_id = bs.id
GROUP BY b.name
ORDER BY completed_low_confidence_sessions DESC, completed DESC
LIMIT 25;

-- 5. Common completed-session conditions by break.
WITH base_sessions AS (
  SELECT
    s.id,
    s.beach_id,
    s.user_id,
    s.status,
    s.wave_height_ft,
    s.wind_speed_mph,
    s.wind_direction,
    s.tide_status
  FROM public.sessions s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE s.deleted_at IS NULL
    AND s.beach_id IS NOT NULL
    AND s.status = 'completed'
    AND s.created_at >= :'start'::timestamptz
    AND s.created_at < :'end'::timestamptz
    AND COALESCE(p.deleted_at IS NULL, TRUE)
    AND COALESCE(p.is_mock, FALSE) = FALSE
    AND COALESCE(p.analytics_is_real_user, TRUE) = TRUE
    AND COALESCE(p.is_system_account, FALSE) = FALSE
),
condition_rows AS (
  SELECT
    b.name AS break,
    CASE
      WHEN bs.wave_height_ft IS NULL THEN NULL
      WHEN bs.wave_height_ft < 2 THEN '<2ft'
      WHEN bs.wave_height_ft < 3 THEN '2-3ft'
      WHEN bs.wave_height_ft < 4 THEN '3-4ft'
      WHEN bs.wave_height_ft < 6 THEN '4-6ft'
      ELSE '6ft+'
    END AS wave_bucket,
    CASE
      WHEN bs.wind_speed_mph IS NULL THEN NULL
      WHEN bs.wind_speed_mph <= 5 THEN '0-5mph'
      WHEN bs.wind_speed_mph <= 10 THEN '6-10mph'
      WHEN bs.wind_speed_mph <= 15 THEN '11-15mph'
      ELSE '16mph+'
    END AS wind_bucket,
    NULLIF(LOWER(TRIM(bs.tide_status)), '') AS tide_status
  FROM base_sessions bs
  JOIN public.beaches b ON b.id = bs.beach_id
)
SELECT
  break,
  MODE() WITHIN GROUP (ORDER BY wave_bucket) AS common_wave_bucket,
  MODE() WITHIN GROUP (ORDER BY wind_bucket) AS common_wind_bucket,
  MODE() WITHIN GROUP (ORDER BY tide_status) AS common_tide_status,
  COUNT(*) AS completed_sessions
FROM condition_rows
GROUP BY break
ORDER BY completed_sessions DESC
LIMIT 25;

-- 6. High-intent, low-completion candidates.
WITH base_sessions AS (
  SELECT s.id, s.beach_id, s.user_id, s.status
  FROM public.sessions s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE s.deleted_at IS NULL
    AND s.beach_id IS NOT NULL
    AND s.created_at >= :'start'::timestamptz
    AND s.created_at < :'end'::timestamptz
    AND COALESCE(p.deleted_at IS NULL, TRUE)
    AND COALESCE(p.is_mock, FALSE) = FALSE
    AND COALESCE(p.analytics_is_real_user, TRUE) = TRUE
    AND COALESCE(p.is_system_account, FALSE) = FALSE
)
SELECT
  b.name AS break,
  COUNT(*) AS planned,
  COUNT(*) FILTER (WHERE bs.status = 'completed') AS completed,
  ROUND(
    COUNT(*) FILTER (WHERE bs.status = 'completed')::numeric
    / NULLIF(COUNT(*), 0),
    3
  ) AS completion_rate,
  COUNT(DISTINCT bs.user_id) AS unique_users
FROM base_sessions bs
JOIN public.beaches b ON b.id = bs.beach_id
GROUP BY b.name
HAVING COUNT(*) >= :min_sessions::int
   AND (
    COUNT(*) FILTER (WHERE bs.status = 'completed')::numeric
    / NULLIF(COUNT(*), 0)
   ) < 0.35
ORDER BY planned DESC, completion_rate ASC;
