-- Supports ordered historical exports and the warehouse's created_at range reads.
-- In production, run the concurrent build first with psql -c outside a transaction:
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_events_created_at_id
--   ON public.user_events (created_at, id);
-- Once the index exists, this migration skips the build and records normally.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_user_events_created_at_id
  ON public.user_events (created_at, id);

COMMIT;
