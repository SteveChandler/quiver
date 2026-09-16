-- Version 20260904120000 belongs to Weekend Scout in production; this migration is unapplied.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

-- The shared queue only keeps its generic dedupe key unique while an event is
-- active. Swell Watch v2 is a one-time recipient/regional-event announcement,
-- so terminal queue rows must remain part of its identity.
ALTER TABLE public.notification_events
  ADD CONSTRAINT notification_events_swell_watch_v2_regional_event_id_check
  CHECK (
    type <> 'swell_watch'
    OR payload ->> 'schema_version' IS DISTINCT FROM 'swell-watch-notification.v2'
    OR (
      jsonb_typeof(payload -> 'regional_event_id') = 'string'
      AND (payload ->> 'regional_event_id') IS NOT NULL
      AND (payload ->> 'regional_event_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
  );

-- Do not delete or reinterpret historical queue rows. Existing duplicate v2
-- announcements require explicit reconciliation before this invariant applies.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.notification_events
    WHERE type = 'swell_watch'
      AND payload ->> 'schema_version' = 'swell-watch-notification.v2'
    GROUP BY recipient_user_id, (payload ->> 'regional_event_id')::uuid
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'swell_watch v2 enqueue duplicates exist; reconcile before applying permanent dedupe';
  END IF;
END $$;

CREATE UNIQUE INDEX notification_events_swell_watch_v2_recipient_event_dedupe
  ON public.notification_events (
    recipient_user_id,
    type,
    ((payload ->> 'regional_event_id')::uuid)
  )
  WHERE type = 'swell_watch'
    AND payload ->> 'schema_version' = 'swell-watch-notification.v2';

COMMIT;
