-- Add `claimed_at` to `notification_events` so the delivery worker can claim
-- pending events atomically, preventing two overlapping cron ticks from
-- double-dispatching the same event.
--
-- Worker pattern (lib/notifications/worker.ts):
--   1. SELECT candidate ids WHERE status='pending' AND
--        (claimed_at IS NULL OR claimed_at < now() - 5 minutes)
--   2. UPDATE notification_events
--        SET claimed_at = now()
--        WHERE id = ANY(candidates)
--          AND status = 'pending'
--          AND (claimed_at IS NULL OR claimed_at < now() - 5 minutes)
--        RETURNING *;
--
-- Postgres row-level locking on UPDATE ensures only one worker wins the claim
-- for any given row; the second worker's WHERE re-check fails because
-- claimed_at is now recent.
--
-- Stale-claim recovery: if a worker crashed mid-tick, claimed_at older than
-- 5 minutes is considered abandoned and the row becomes claimable again.
-- The retry interval for failed pushes that leave the event pending therefore
-- caps at ~5 minutes (acceptable for v1).

BEGIN;

ALTER TABLE notification_events
  ADD COLUMN claimed_at timestamptz;

-- Partial index supports the worker's claim query — the same `status='pending'`
-- predicate as `idx_notification_events_pending`, but ordered to make the
-- "claimable now" set a short index scan.
CREATE INDEX idx_notification_events_claim
  ON notification_events (claimed_at NULLS FIRST, created_at)
  WHERE status = 'pending';

COMMENT ON COLUMN notification_events.claimed_at IS
  'Timestamp the delivery worker took ownership of this row. NULL means '
  'unclaimed; a value older than 5 minutes is treated as abandoned and may '
  'be reclaimed. See lib/notifications/worker.ts.';

COMMIT;
