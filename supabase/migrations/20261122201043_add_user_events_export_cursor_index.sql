-- Supports ordered historical exports and the warehouse's created_at range reads.
-- Run outside a transaction. If the build fails and leaves an invalid index,
-- drop the invalid index using the rollback before retrying.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_events_created_at_id
  ON public.user_events (created_at, id);
