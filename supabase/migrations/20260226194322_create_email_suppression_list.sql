-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

CREATE TABLE IF NOT EXISTS email_suppression_list (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('hard_bounce', 'typo', 'manual', 'complaint')),
  suppressed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(email)
);

ALTER TABLE email_suppression_list ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE email_suppression_list IS 'Emails that should not receive outbound email. Checked by cron routes before sending.';

INSERT INTO email_suppression_list (email, reason, notes)
VALUES ('chrisluna220@gmail.co', 'typo', 'Typo duplicate of chrisluna220@gmail.com — discovered Feb 2026')
ON CONFLICT (email) DO NOTHING;
