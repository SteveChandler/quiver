-- Apply this statement alone with psql -c outside a transaction.
-- Do not run it inside a transaction because DROP INDEX CONCURRENTLY requires autocommit.
DROP INDEX CONCURRENTLY IF EXISTS public.idx_ml_predictions_log_created_at_id;
