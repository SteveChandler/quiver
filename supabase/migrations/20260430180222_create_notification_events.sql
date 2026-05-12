-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

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

CREATE INDEX notification_events_pending_idx
  ON notification_events (created_at)
  WHERE status = 'pending';

CREATE INDEX notification_events_recipient_idx
  ON notification_events (recipient_user_id, created_at DESC);

CREATE UNIQUE INDEX notification_events_dedupe_idx
  ON notification_events (recipient_user_id, type, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own notification events"
  ON notification_events FOR SELECT
  USING ((SELECT auth.uid()) = recipient_user_id);
