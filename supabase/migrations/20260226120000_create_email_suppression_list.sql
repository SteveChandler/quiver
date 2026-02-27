-- Email Suppression List
-- Tracks emails that should not receive any outbound email.
-- Reasons: hard_bounce (from Resend webhook), typo (known bad domain),
-- manual (operator override), complaint (spam report).

BEGIN;

CREATE TABLE IF NOT EXISTS email_suppression_list (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('hard_bounce', 'typo', 'manual', 'complaint')),
  suppressed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(email)
);

-- Enable RLS (required by project security standards)
ALTER TABLE email_suppression_list ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (no user access needed)
-- RLS enabled with no public policies = only service_role/postgres can access
COMMENT ON TABLE email_suppression_list IS 'Emails that should not receive outbound email. Checked by cron routes before sending.';

-- Note: UNIQUE(email) already provides a B-tree index for fast lookups

-- Seed: suppress the known typo duplicate
INSERT INTO email_suppression_list (email, reason, notes)
VALUES ('chrisluna220@gmail.co', 'typo', 'Typo duplicate of chrisluna220@gmail.com — discovered Feb 2026')
ON CONFLICT (email) DO NOTHING;

COMMIT;
