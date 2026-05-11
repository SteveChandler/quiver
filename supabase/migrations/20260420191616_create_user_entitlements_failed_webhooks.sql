-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

CREATE TABLE user_entitlements_failed_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type text,
  payload jsonb NOT NULL,
  error_message text,
  retry_count int NOT NULL DEFAULT 0,
  received_at timestamptz NOT NULL DEFAULT now(),
  last_retried_at timestamptz
);

CREATE INDEX idx_rc_dlq_received_at
  ON user_entitlements_failed_webhooks(received_at DESC);

CREATE INDEX idx_rc_dlq_user_id
  ON user_entitlements_failed_webhooks(user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE user_entitlements_failed_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages rc DLQ"
  ON user_entitlements_failed_webhooks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
