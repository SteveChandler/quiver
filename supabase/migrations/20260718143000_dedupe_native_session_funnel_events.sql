BEGIN;

LOCK TABLE public.user_events IN SHARE ROW EXCLUSIVE MODE;

-- Preserve every historical row while assigning a distinct key to later
-- duplicates. Canonical native callers already send stable event_id values;
-- the repair only makes a forward unique index safe on existing data.
WITH ranked_duplicates AS (
  SELECT
    id,
    metadata ->> 'event_id' AS event_id,
    row_number() OVER (
      PARTITION BY user_id, metadata ->> 'event_id'
      ORDER BY created_at, id
    ) AS duplicate_rank
  FROM public.user_events
  WHERE event_type IN (
    'session_log_start',
    'session_log_form_view',
    'session_log_validation_failed',
    'session_log_submit'
  )
    AND metadata ->> 'event_id' IS NOT NULL
    AND metadata ->> 'event_id' <> ''
)
UPDATE public.user_events AS user_event
SET metadata = jsonb_set(
  user_event.metadata,
  '{event_id}',
  to_jsonb(
    ranked_duplicates.event_id
      || ':legacy-duplicate:'
      || user_event.id::text
  ),
  false
)
FROM ranked_duplicates
WHERE user_event.id = ranked_duplicates.id
  AND ranked_duplicates.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS user_events_native_session_funnel_event_id_uidx
  ON public.user_events (user_id, ((metadata ->> 'event_id')))
  WHERE event_type IN (
    'session_log_start',
    'session_log_form_view',
    'session_log_validation_failed',
    'session_log_submit'
  )
    AND metadata ->> 'event_id' IS NOT NULL
    AND metadata ->> 'event_id' <> '';

COMMENT ON INDEX public.user_events_native_session_funnel_event_id_uidx IS
  'Idempotency guard for owner-scoped canonical native session funnel events.';

COMMIT;
