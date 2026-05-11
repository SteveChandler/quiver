-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

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
