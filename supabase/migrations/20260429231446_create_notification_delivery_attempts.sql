-- Per-(event, channel) outcome log for the notification delivery worker.
-- One row per channel attempt — sent, every skip variant, every failure.
-- Lets us answer "did a push fire for X yesterday and if not, why?" with a
-- single SELECT.
--
-- Companion to notification_events. The pair replaces:
--   - alert_delivery_attempts (push channel only — email stays separate)
--   - push_notification_log (digest only — frozen, then dropped)
--   - trial_ending_push_log, activation_push_log, forecast_alert_deliveries
--
-- Plan: ~/.claude/plans/on-quiver-native-we-have-snug-tiger.md (Phase 1).

BEGIN;

CREATE TABLE notification_delivery_attempts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_event_id uuid NOT NULL REFERENCES notification_events(id) ON DELETE CASCADE,
  channel               text NOT NULL CHECK (channel IN (
    'push',
    'in_app',
    'email'
  )),
  status                text NOT NULL CHECK (status IN (
    'sent',
    'skipped_no_device',
    'skipped_pref_master',
    'skipped_pref_type',
    'skipped_self',
    'skipped_dedup',
    'skipped_disabled',
    'skipped_quiet_hours',
    'failed_provider',
    'failed_internal'
  )),
  provider_response     jsonb,
  error_message         text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notification_delivery_attempts_event_idx
  ON notification_delivery_attempts (notification_event_id);

CREATE INDEX notification_delivery_attempts_channel_status_idx
  ON notification_delivery_attempts (channel, status, created_at DESC);

ALTER TABLE notification_delivery_attempts ENABLE ROW LEVEL SECURITY;
-- service_role only — no policies. Users can read their own outcomes via
-- the admin diagnostics endpoint, not directly.

COMMIT;
