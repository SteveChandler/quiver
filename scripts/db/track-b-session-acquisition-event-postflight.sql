-- Read-only postflight for an approved apply of:
--   supabase/migrations/20260619173000_add_session_log_conditions_set_event.sql
--
-- Run after the approved migration apply:
--   psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/track-b-session-acquisition-event-postflight.sql

BEGIN READ ONLY;

SELECT 'track_b_event_allowlist_postflight' AS check_name;

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
    ) AS target_event_allowed
)
SELECT
  user_events_table_exists,
  event_type_check_exists,
  target_event_allowed,
  user_events_table_exists
    AND event_type_check_exists
    AND target_event_allowed AS track_b_event_allowlist_ready
FROM summary;

SELECT 'track_b_event_postflight_blockers' AS check_name;

WITH target_event AS (
  SELECT 'session_log_conditions_set'::text AS event_type
),
table_state AS (
  SELECT to_regclass('public.user_events') AS user_events_regclass
),
constraint_state AS (
  SELECT pg_get_constraintdef(c.oid) AS constraint_def
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
    EXISTS (SELECT 1 FROM constraint_state) AS event_type_check_exists,
    EXISTS (
      SELECT 1
      FROM constraint_state AS c
      CROSS JOIN target_event AS t
      WHERE c.constraint_def ~ (
        '(^|[^[:alnum:]_])' || t.event_type || '([^[:alnum:]_]|$)'
      )
    ) AS target_event_allowed
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
  UNION ALL
  SELECT
    'session_log_conditions_set_not_allowed',
    'session_log_conditions_set is not accepted by user_events_event_type_check.',
    'target_event_allowed=false',
    NOT target_event_allowed
  FROM summary
) blockers
WHERE is_blocked
ORDER BY blocker_code;

WITH target_event AS (
  SELECT 'session_log_conditions_set'::text AS event_type
),
table_state AS (
  SELECT to_regclass('public.user_events') AS user_events_regclass
),
constraint_state AS (
  SELECT pg_get_constraintdef(c.oid) AS constraint_def
  FROM pg_constraint AS c
  JOIN table_state AS t
    ON t.user_events_regclass IS NOT NULL
   AND c.conrelid = t.user_events_regclass
  WHERE c.conname = 'user_events_event_type_check'
),
summary AS (
  SELECT
    (SELECT user_events_regclass IS NOT NULL FROM table_state)
      AND EXISTS (SELECT 1 FROM constraint_state)
      AS rows_query_safe,
    (SELECT user_events_regclass IS NOT NULL FROM table_state)
      AND EXISTS (SELECT 1 FROM constraint_state)
      AND EXISTS (
        SELECT 1
        FROM constraint_state AS c
        CROSS JOIN target_event AS t
        WHERE c.constraint_def ~ (
          '(^|[^[:alnum:]_])' || t.event_type || '([^[:alnum:]_]|$)'
        )
      ) AS postflight_passed
)
SELECT
  CASE
    WHEN postflight_passed THEN 1
    ELSE 0
  END AS track_b_event_postflight_passed,
  CASE
    WHEN rows_query_safe THEN 1
    ELSE 0
  END AS track_b_event_rows_query_safe
FROM summary
\gset

SELECT
  :track_b_event_postflight_passed AS track_b_event_postflight_passed,
  :track_b_event_rows_query_safe AS track_b_event_rows_query_safe;

\if :track_b_event_rows_query_safe

SELECT 'track_b_conditions_set_event_rows' AS check_name;

SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') AS recent_7d_rows,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS recent_24h_rows
FROM public.user_events
WHERE event_type = 'session_log_conditions_set';

\else

SELECT 'track_b_conditions_set_event_rows_skipped' AS check_name;

SELECT
  'user_events or user_events_event_type_check is missing'
    AS skipped_reason;

\endif

\if :track_b_event_postflight_passed
ROLLBACK;
\else
ROLLBACK;
DO $$
BEGIN
  RAISE EXCEPTION
    'Track B session acquisition event postflight failed; see track_b_event_postflight_blockers above.';
END
$$;
\endif
