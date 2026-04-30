-- Phase 5a: schema gap-close for the centralized notifications pipeline.
--
-- Closes structural gaps that surfaced after Phases 1-4 shipped:
--   - status model conflated event-level vs channel-level outcomes
--   - no claim_token for transactional FOR UPDATE SKIP LOCKED claim
--   - no attempt_count / next_attempt_at / last_error for retry/backoff
--   - skipped_quiet_hours was named like a terminal skip but is retryable
--   - dedupe index was permanent — blocked legitimate re-engagement
--
-- All status columns are TEXT + CHECK (not Postgres ENUMs), so this rewrites
-- the CHECK constraints rather than ALTER TYPE.
--
-- Plan: ~/.claude/plans/on-quiver-native-we-have-snug-tiger.md (Phase 5a).

BEGIN;

-- ─── notification_events: new columns ───────────────────────────────────────

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

-- ─── notification_events: status CHECK rewrite ──────────────────────────────
-- Old: pending, processed, skipped, failed
-- New: pending, processing, processed, failed, cancelled
--   (skipped is dropped — skips are channel-level, not event-level)
-- Existing 'skipped' rows are backfilled to 'processed' (their channels were
-- decisively skipped, so the event reached its terminal "we decided what to
-- do with this" state — `processed` is the correct event-level analog).

UPDATE notification_events SET status = 'processed' WHERE status = 'skipped';

ALTER TABLE notification_events DROP CONSTRAINT IF EXISTS notification_events_status_check;
ALTER TABLE notification_events
  ADD CONSTRAINT notification_events_status_check
  CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'cancelled'));

-- ─── notification_events: claim index swap ──────────────────────────────────
-- Old idx_notification_events_pending: WHERE status='pending', ordered by created_at
-- Old idx_notification_events_claim:    WHERE status='pending', ordered by (claimed_at NULLS FIRST, created_at)
-- Both became inadequate once `processing` is a separate state.
-- New: cover both pending and processing rows, ordered by next_attempt_at first
-- so retry-scheduled rows land in the right slot.

DROP INDEX IF EXISTS notification_events_pending_idx;
DROP INDEX IF EXISTS idx_notification_events_pending;
DROP INDEX IF EXISTS idx_notification_events_claim;

CREATE INDEX idx_notification_events_claimable
  ON notification_events (next_attempt_at NULLS FIRST, created_at)
  WHERE status IN ('pending', 'processing');

-- ─── notification_events: dedupe index swap ─────────────────────────────────
-- Old: permanent unique on (recipient, type, dedupe_key) — blocked legitimate
-- re-enqueue once the original event finalized.
-- New: active-only unique — once an event reaches terminal state, the same
-- dedupe_key may be enqueued again (e.g. follow re-engagement after weekly
-- bucket rolls).

DROP INDEX IF EXISTS notification_events_dedupe_idx;
DROP INDEX IF EXISTS idx_notification_events_dedupe;

CREATE UNIQUE INDEX idx_notification_events_active_dedupe
  ON notification_events (recipient_user_id, type, dedupe_key)
  WHERE dedupe_key IS NOT NULL
    AND status IN ('pending', 'processing');

-- ─── notification_delivery_attempts: attempt_number column ──────────────────
-- Lets the admin diagnostics endpoint group attempts per channel per attempt,
-- and lets observability count "events on attempt 2+".

ALTER TABLE notification_delivery_attempts
  ADD COLUMN attempt_number integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN notification_delivery_attempts.attempt_number IS
  'Which retry attempt this row records (1-indexed). Worker copies the parent event.attempt_count at write time.';

-- ─── notification_delivery_attempts: status rename + new value ──────────────
-- Renames skipped_quiet_hours → deferred_quiet_hours (clearer: it is retryable,
-- not a terminal skip).
-- Adds skipped_cooldown for the new per-type cooldownMs registry knob.

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

COMMIT;
