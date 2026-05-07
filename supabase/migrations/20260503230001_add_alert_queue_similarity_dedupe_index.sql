BEGIN;

-- Cleanup: keep only the lowest-id row per (user_id, alert_date) where the row
-- is similarity_match. In production prod-default-OFF this should be empty,
-- but kept for idempotency.
DELETE FROM alert_queue a
USING alert_queue b
WHERE a.user_id = b.user_id
  AND a.alert_date = b.alert_date
  AND (a.conditions_snapshot->>'alert_type') = 'similarity_match'
  AND (b.conditions_snapshot->>'alert_type') = 'similarity_match'
  AND a.id > b.id;

-- Partial unique index — postgres-correct expression of
-- "one similarity_match row per user/day". Note: this is a partial unique
-- INDEX, not a CONSTRAINT. ON CONFLICT inference uses the (user_id, alert_date)
-- columns + the WHERE predicate to match this index.
CREATE UNIQUE INDEX IF NOT EXISTS alert_queue_one_similarity_per_user_day
  ON alert_queue (user_id, alert_date)
  WHERE (conditions_snapshot->>'alert_type') = 'similarity_match';

COMMENT ON INDEX alert_queue_one_similarity_per_user_day IS
  'Dedupe rail for similarity_match alert_queue rows: at most one per (user_id, alert_date). Inferred by try_insert_similarity_alert via ON CONFLICT (user_id, alert_date) WHERE (conditions_snapshot->>''alert_type'')=''similarity_match''.';

COMMIT;
