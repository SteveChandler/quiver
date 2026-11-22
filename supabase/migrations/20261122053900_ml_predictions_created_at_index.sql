-- Apply this statement alone with psql -c outside a transaction.
-- Do not apply it with supabase db push, which wraps each migration file in a transaction.
-- After applying, record it before db push with supabase migration repair --linked --status applied 20261122053900.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_predictions_log_created_at_id
  ON public.ml_predictions_log (created_at, id);
