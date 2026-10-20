BEGIN;
-- The build holds a SHARE lock on user_events, and app inserts give up after the
-- authenticator's 8 s lock_timeout. Fail fast instead of queueing behind a long
-- reader, and abort rather than hold inserts for long.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- evaluate_email_lifecycle reads one user's recent events of a few types. For a
-- user who owns ~11% of user_events the planner prefers the event_type index,
-- reads every user's matching events (~6.4k heap pages) and filters by user,
-- which crossed the 8 s authenticator statement_timeout on Oct 19. This index
-- makes both of the function's user_events lookups a per-user range scan.
CREATE INDEX IF NOT EXISTS idx_user_events_user_type_created
  ON public.user_events (user_id, event_type, created_at DESC)
  WHERE bot_flagged IS NOT TRUE;

COMMENT ON INDEX public.idx_user_events_user_type_created IS
  'Supports the per-user activity lookups in evaluate_email_lifecycle.';

COMMIT;
