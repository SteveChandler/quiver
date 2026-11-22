-- In production, use psql -c outside a transaction instead:
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_user_events_created_at_id;

BEGIN;

DROP INDEX IF EXISTS public.idx_user_events_created_at_id;

COMMIT;
