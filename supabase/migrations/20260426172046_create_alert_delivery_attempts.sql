-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Per-attempt observability for the alert delivery worker.
--
-- The existing `alert_deliveries` table is a digest log — one row per
-- (user_id, alert_date, channel) enforced by idx_alert_deliveries_dedup.
-- That is correct for "what the user received" but cannot record per-rule
-- outcomes or skipped attempts. This table is the source of truth for
-- per-(queue_row × channel) outcomes, including all skip reasons.
--
-- See docs/archive/superpowers/specs/2026-04-25-alerts-engine-fix-and-anon-capture-design.md
-- section A1 for the full design and decision order.

BEGIN;

CREATE TABLE alert_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES alert_queue(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'push')),
  status text NOT NULL CHECK (status IN (
    'sent',
    'skipped_disabled',
    'skipped_allowlist',
    'skipped_cooldown',
    'skipped_user_cap',
    'skipped_no_device',
    'skipped_channel_disabled',
    'skipped_dedup_collision',
    'failed_provider',
    'failed_internal'
  )),
  skip_reason text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX alert_delivery_attempts_rule_sent_idx
  ON alert_delivery_attempts (rule_id, attempted_at DESC)
  WHERE status = 'sent';

CREATE INDEX alert_delivery_attempts_user_sent_idx
  ON alert_delivery_attempts (user_id, attempted_at DESC)
  WHERE status = 'sent';

CREATE INDEX alert_delivery_attempts_queue_idx
  ON alert_delivery_attempts (queue_id);

ALTER TABLE alert_delivery_attempts ENABLE ROW LEVEL SECURITY;
-- No policies created — only `service_role` (used by the cron worker)
-- can read/write. Users do not need to read this table directly.

COMMIT;
