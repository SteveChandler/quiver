-- Read-only preflight for:
--   supabase/migrations/20260619173000_add_session_log_conditions_set_event.sql
--
-- Run before requesting production approval:
--   psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/track-b-session-acquisition-event-preflight.sql

BEGIN READ ONLY;

SELECT 'track_b_event_allowlist_preflight' AS check_name;

WITH target_event AS (
  SELECT 'session_log_conditions_set'::text AS event_type
),
table_state AS (
  SELECT to_regclass('public.user_events') AS user_events_regclass
),
constraint_state AS (
  SELECT
    c.oid,
    pg_get_constraintdef(c.oid) AS constraint_def
  FROM pg_constraint AS c
  JOIN table_state AS t
    ON t.user_events_regclass IS NOT NULL
   AND c.conrelid = t.user_events_regclass
  WHERE c.conname = 'user_events_event_type_check'
),
summary AS (
  SELECT
    (SELECT user_events_regclass IS NOT NULL FROM table_state) AS user_events_table_exists,
    EXISTS (SELECT 1 FROM constraint_state) AS event_type_check_exists,
    EXISTS (
      SELECT 1
      FROM constraint_state AS c
      CROSS JOIN target_event AS t
      WHERE c.constraint_def ~ (
        '(^|[^[:alnum:]_])' || t.event_type || '([^[:alnum:]_]|$)'
      )
    ) AS target_event_already_allowed
)
SELECT
  user_events_table_exists,
  event_type_check_exists,
  target_event_already_allowed,
  event_type_check_exists
    AND NOT target_event_already_allowed AS migration_needed,
  user_events_table_exists
    AND event_type_check_exists AS can_request_track_b_event_migration_approval
FROM summary;

SELECT 'track_b_event_preflight_blockers' AS check_name;

WITH table_state AS (
  SELECT to_regclass('public.user_events') AS user_events_regclass
),
constraint_state AS (
  SELECT 1
  FROM pg_constraint AS c
  JOIN table_state AS t
    ON t.user_events_regclass IS NOT NULL
   AND c.conrelid = t.user_events_regclass
  WHERE c.conname = 'user_events_event_type_check'
),
summary AS (
  SELECT
    (SELECT user_events_regclass IS NOT NULL FROM table_state)
      AS user_events_table_exists,
    EXISTS (SELECT 1 FROM constraint_state) AS event_type_check_exists
)
SELECT blocker_code, blocker_message, detail
FROM (
  SELECT
    'missing_user_events_table' AS blocker_code,
    'public.user_events is missing.' AS blocker_message,
    'user_events_table_exists=false' AS detail,
    NOT user_events_table_exists AS is_blocked
  FROM summary
  UNION ALL
  SELECT
    'missing_user_events_event_type_check',
    'user_events_event_type_check is missing.',
    'event_type_check_exists=false',
    NOT event_type_check_exists
  FROM summary
) blockers
WHERE is_blocked
ORDER BY blocker_code;

WITH table_state AS (
  SELECT to_regclass('public.user_events') AS user_events_regclass
),
constraint_state AS (
  SELECT 1
  FROM pg_constraint AS c
  JOIN table_state AS t
    ON t.user_events_regclass IS NOT NULL
   AND c.conrelid = t.user_events_regclass
  WHERE c.conname = 'user_events_event_type_check'
),
summary AS (
  SELECT
    (SELECT user_events_regclass IS NOT NULL FROM table_state)
      AND EXISTS (SELECT 1 FROM constraint_state) AS preflight_passed
)
SELECT
  CASE
    WHEN preflight_passed THEN 1
    ELSE 0
  END AS track_b_event_preflight_passed
FROM summary
\gset

SELECT :track_b_event_preflight_passed AS track_b_event_preflight_passed;

\if :track_b_event_preflight_passed

SELECT 'track_b_recent_session_funnel_events' AS check_name;

SELECT
  event_type,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') AS recent_7d_rows,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS recent_24h_rows
FROM public.user_events
WHERE event_type IN (
  'session_log_start',
  'session_log_beach_selected',
  'session_log_conditions_set',
  'session_log_rating_set',
  'session_log_validation_failed',
  'session_log_abandon',
  'session_log_submit',
  'first_session_logged'
)
GROUP BY event_type
ORDER BY event_type;

\else

SELECT 'track_b_recent_session_funnel_events_skipped' AS check_name;

SELECT 'user_events or user_events_event_type_check is missing' AS skipped_reason;

\endif

\if :track_b_event_preflight_passed
ROLLBACK;
\else
ROLLBACK;
DO $$
BEGIN
  RAISE EXCEPTION
    'Track B session acquisition event preflight failed; see track_b_event_preflight_blockers above.';
END
$$;
\endif
