-- Backfilled from remote supabase_migrations.schema_migrations on 2026-04-08
-- to reconcile drift from a parallel branch that applied directly to prod.
-- This migration was already applied to prod on 2026-04-08 16:30:00 UTC.
-- Supersedes the earlier 20260401000000_add_condition_alerts.sql which was
-- deleted as part of this drift fix (the original used moddatetime which
-- isn't installed on this project; this version uses public.set_updated_at()).

BEGIN;

-- Alert rules: one row per user-defined alert on a beach
CREATE TABLE alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beach_id uuid NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
  name text NOT NULL,
  preset_type text CHECK (preset_type IN (
    'glass_off', 'big_day', 'clean_groundswell', 'mellow_session',
    'tide_window', 'dawn_patrol', 'epic_conditions'
  )),
  conditions jsonb NOT NULL DEFAULT '{}',
  notify_email boolean NOT NULL DEFAULT true,
  notify_push boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  last_matched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_rules_user_id ON alert_rules(user_id);
CREATE INDEX idx_alert_rules_beach_id ON alert_rules(beach_id);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(user_id, enabled) WHERE enabled = true;

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own alert rules"
  ON alert_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alert rules"
  ON alert_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alert rules"
  ON alert_rules FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own alert rules"
  ON alert_rules FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can read all alert rules"
  ON alert_rules FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can update alert rules"
  ON alert_rules FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Alert queue: evaluation cron writes here, delivery cron reads
CREATE TABLE alert_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  beach_id uuid NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
  alert_date date NOT NULL,
  send_at timestamptz NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  best_hour timestamptz NOT NULL,
  conditions_snapshot jsonb NOT NULL DEFAULT '{}',
  sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_queue_delivery ON alert_queue(sent, send_at) WHERE sent = false;
CREATE INDEX idx_alert_queue_user_date ON alert_queue(user_id, alert_date);

ALTER TABLE alert_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage alert queue"
  ON alert_queue FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Alert deliveries: deduplication tracking
CREATE TABLE alert_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_date date NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'push')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_alert_deliveries_dedup
  ON alert_deliveries(user_id, alert_date, channel);

ALTER TABLE alert_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage alert deliveries"
  ON alert_deliveries FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read own alert deliveries"
  ON alert_deliveries FOR SELECT
  USING (auth.uid() = user_id);

-- Updated_at trigger for alert_rules.
-- Uses the codebase-standard public.set_updated_at() function (see
-- 20251224160000_add_forecast_alerts.sql and 20250922100001_create_push_devices_table_fixed.sql).
-- The original version of this migration referenced moddatetime(updated_at),
-- which relies on a Postgres contrib extension that was never installed on
-- this project. That bug prevented the migration from applying successfully.
CREATE TRIGGER set_alert_rules_updated_at
  BEFORE UPDATE ON alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;
