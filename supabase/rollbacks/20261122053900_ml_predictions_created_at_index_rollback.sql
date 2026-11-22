-- In production, restore the prior function first, then use psql -c outside a transaction.
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_ml_predictions_log_created_at_id;

BEGIN;

DROP INDEX IF EXISTS public.idx_ml_predictions_log_created_at_id;

COMMIT;
