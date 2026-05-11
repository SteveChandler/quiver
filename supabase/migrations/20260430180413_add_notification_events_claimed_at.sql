-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

ALTER TABLE notification_events
  ADD COLUMN claimed_at timestamptz;

CREATE INDEX idx_notification_events_claim
  ON notification_events (claimed_at NULLS FIRST, created_at)
  WHERE status = 'pending';

COMMENT ON COLUMN notification_events.claimed_at IS
  'Timestamp the delivery worker took ownership of this row. NULL means unclaimed; a value older than 5 minutes is treated as abandoned and may be reclaimed. See lib/notifications/worker.ts.';
