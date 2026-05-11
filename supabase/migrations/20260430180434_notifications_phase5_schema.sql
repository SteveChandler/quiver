-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

ALTER TABLE notification_events
  ADD COLUMN attempt_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN next_attempt_at  timestamptz,
  ADD COLUMN last_attempt_at  timestamptz,
  ADD COLUMN claim_token      uuid,
  ADD COLUMN cancel_reason    text,
  ADD COLUMN last_error       text;

COMMENT ON COLUMN notification_events.attempt_count IS
  'Incremented each time the worker claims this event. Capped per the registry maxAttempts (default 3).';
COMMENT ON COLUMN notification_events.next_attempt_at IS
  'Earliest time the worker may re-claim this event. Set on retryable failure (1m/5m/30m backoff) and on deferred_quiet_hours.';
COMMENT ON COLUMN notification_events.last_attempt_at IS
  'Most recent claim timestamp. Distinct from claimed_at, which is cleared when the lease is released.';
COMMENT ON COLUMN notification_events.claim_token IS
  'Per-claim UUID set by claim_notification_events RPC. Workers write terminal status only WHERE claim_token = $own — defends against stale-lease races.';
COMMENT ON COLUMN notification_events.cancel_reason IS
  'Set when status=cancelled. Used by upstream/business reasons (e.g. recipient deleted account) to record why an event will never deliver.';
COMMENT ON COLUMN notification_events.last_error IS
  'Last failure message (truncated). Surfaced by /api/admin/notifications/recent.';

UPDATE notification_events SET status = 'processed' WHERE status = 'skipped';

ALTER TABLE notification_events DROP CONSTRAINT IF EXISTS notification_events_status_check;
ALTER TABLE notification_events
  ADD CONSTRAINT notification_events_status_check
  CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'cancelled'));

DROP INDEX IF EXISTS notification_events_pending_idx;
DROP INDEX IF EXISTS idx_notification_events_pending;
DROP INDEX IF EXISTS idx_notification_events_claim;

CREATE INDEX idx_notification_events_claimable
  ON notification_events (next_attempt_at NULLS FIRST, created_at)
  WHERE status IN ('pending', 'processing');

DROP INDEX IF EXISTS notification_events_dedupe_idx;
DROP INDEX IF EXISTS idx_notification_events_dedupe;

CREATE UNIQUE INDEX idx_notification_events_active_dedupe
  ON notification_events (recipient_user_id, type, dedupe_key)
  WHERE dedupe_key IS NOT NULL
    AND status IN ('pending', 'processing');

ALTER TABLE notification_delivery_attempts
  ADD COLUMN attempt_number integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN notification_delivery_attempts.attempt_number IS
  'Which retry attempt this row records (1-indexed). Worker copies the parent event.attempt_count at write time.';

UPDATE notification_delivery_attempts
  SET status = 'deferred_quiet_hours'
  WHERE status = 'skipped_quiet_hours';

ALTER TABLE notification_delivery_attempts DROP CONSTRAINT IF EXISTS notification_delivery_attempts_status_check;
ALTER TABLE notification_delivery_attempts
  ADD CONSTRAINT notification_delivery_attempts_status_check
  CHECK (status IN (
    'sent',
    'skipped_no_device',
    'skipped_pref_master',
    'skipped_pref_type',
    'skipped_self',
    'skipped_dedup',
    'skipped_disabled',
    'skipped_cooldown',
    'deferred_quiet_hours',
    'failed_provider',
    'failed_internal'
  ));
