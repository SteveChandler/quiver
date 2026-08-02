BEGIN;

LOCK TABLE public.user_events IN SHARE ROW EXCLUSIVE MODE;

-- The native client retries an install-to-user join until local durable
-- acknowledgement. Enforce its deterministic event_id at the database edge
-- so a process death after insert cannot create a second attribution row.
WITH ranked_duplicates AS (
  SELECT
    id,
    metadata ->> 'event_id' AS event_id,
    row_number() OVER (
      PARTITION BY user_id, metadata ->> 'event_id'
      ORDER BY created_at, id
    ) AS duplicate_rank
  FROM public.user_events
  WHERE event_type = 'native_install_attribution_joined'
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

CREATE UNIQUE INDEX IF NOT EXISTS user_events_native_install_attribution_event_id_uidx
  ON public.user_events (user_id, ((metadata ->> 'event_id')))
  WHERE event_type = 'native_install_attribution_joined'
    AND metadata ->> 'event_id' IS NOT NULL
    AND metadata ->> 'event_id' <> '';

COMMENT ON INDEX public.user_events_native_install_attribution_event_id_uidx IS
  'Idempotency guard for owner-scoped native install attribution joins.';

COMMIT;
