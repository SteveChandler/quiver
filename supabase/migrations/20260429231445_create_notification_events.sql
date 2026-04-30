-- Centralized notification event log. The producer side of a two-stage
-- notification pipeline: producers (routes/crons) write a durable event
-- here, and a single delivery worker (cron: notifications-deliver) reads,
-- applies prefs/dedupe/self-suppress, and dispatches to push + in-app.
--
-- Replaces ad-hoc direct push sends scattered across feature routes and
-- the per-feature log tables (push_notification_log, trial_ending_push_log,
-- activation_push_log, forecast_alert_deliveries).
--
-- Plan: ~/.claude/plans/on-quiver-native-we-have-snug-tiger.md (Phase 1).

BEGIN;

CREATE TABLE notification_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type              text NOT NULL,
  entity_type       text,
  entity_id         uuid,
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key        text,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processed',
    'skipped',
    'failed'
  )),
  skip_reason       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz
);

-- Worker fetches pending events ordered by created_at; partial index keeps
-- the working set small as processed/skipped/failed events accumulate.
CREATE INDEX notification_events_pending_idx
  ON notification_events (created_at)
  WHERE status = 'pending';

CREATE INDEX notification_events_recipient_idx
  ON notification_events (recipient_user_id, created_at DESC);

-- Dedupe: a producer can pass a dedupe_key (e.g. `like:{session_id}:{actor}`)
-- to ensure the same logical event isn't enqueued twice. NULL dedupe_key
-- skips the constraint so most types remain unaffected.
CREATE UNIQUE INDEX notification_events_dedupe_idx
  ON notification_events (recipient_user_id, type, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own notification events"
  ON notification_events FOR SELECT
  USING ((SELECT auth.uid()) = recipient_user_id);

-- INSERT/UPDATE/DELETE limited to service_role (cron worker + producers).

COMMIT;
