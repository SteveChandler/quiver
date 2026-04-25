-- user_entitlements_failed_webhooks — DLQ for RC webhook deliveries that
-- the `/api/webhooks/revenuecat` route could not apply to user_entitlements.
--
-- RC retries webhooks with exponential backoff, but delivery-to-application
-- can still fail (signature verify, malformed payload, missing auth.users row
-- for an app_user_id we haven't seen yet, race with a user deletion, etc.).
-- Each such failure lands here. A daily cron should sweep rows by pulling
-- fresh state from the RC REST API.
--
-- This table is intentionally append-only from the webhook and read-only from
-- clients; reconciliation is a service-role operation.
--
-- Rollback:
--   DROP TABLE IF EXISTS user_entitlements_failed_webhooks;

BEGIN;

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

-- Service role only — this is an ops table.
CREATE POLICY "Service role manages rc DLQ"
  ON user_entitlements_failed_webhooks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
