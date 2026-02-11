BEGIN;

-- Add webhook tracking columns to email_send_log
ALTER TABLE email_send_log
  ADD COLUMN IF NOT EXISTS resend_message_id text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz;

-- Partial index for fast webhook lookups (excludes old rows without IDs)
CREATE INDEX IF NOT EXISTS idx_email_send_log_resend_message_id
  ON email_send_log (resend_message_id)
  WHERE resend_message_id IS NOT NULL;

COMMIT;
