BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_queue_rule_dedup
  ON alert_queue(rule_id, alert_date, window_start);

COMMIT;
