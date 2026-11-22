-- In production, run the concurrent build first with psql -c outside a transaction.
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_predictions_log_created_at_id
--   ON public.ml_predictions_log (created_at, id);
-- Once the index exists, this migration skips the build and records normally.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_ml_predictions_log_created_at_id
  ON public.ml_predictions_log (created_at, id);

COMMIT;
