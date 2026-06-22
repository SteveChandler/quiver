-- Rollback for supabase/migrations/20260618160000_phase0_forecast_accuracy_metrics.sql
--
-- Purpose:
--   Restore the pre-Phase-0 ml_predictions_log conflict target so older
--   application code that upserts on (beach_id, predicted_at) works again.
--
-- Important:
--   This rollback intentionally leaves additive objects in place
--   (forecast_horizon_bucket, metric RPCs, and comments) to avoid data loss and
--   to keep dashboards readable after rollback. It refuses to run if Phase 0
--   has already captured multiple display snapshots for the same beach/slot,
--   because recreating the old unique index would require deleting or archiving
--   measurement rows.

BEGIN;

DO $$
BEGIN
  IF current_setting('app.phase0_forecast_accuracy_rollback_approved', true)
    IS DISTINCT FROM '2026-06-19-phase0-forecast-accuracy-rollback-approved'
  THEN
    RAISE EXCEPTION
      'Phase 0 forecast accuracy rollback requires explicit human approval. Set app.phase0_forecast_accuracy_rollback_approved=2026-06-19-phase0-forecast-accuracy-rollback-approved in the same database session after approval.';
  END IF;
END $$;

DO $$
DECLARE
  duplicate_group_count integer;
BEGIN
  SELECT COUNT(*)::integer
  INTO duplicate_group_count
  FROM (
    SELECT beach_id, predicted_at, COUNT(*) AS row_count
    FROM public.ml_predictions_log
    GROUP BY beach_id, predicted_at
    HAVING COUNT(*) > 1
  ) duplicate_groups;

  IF duplicate_group_count > 0 THEN
    RAISE EXCEPTION
      'Cannot restore idx_ml_predictions_beach_predicted_at_unique: % duplicate beach/predicted_at groups exist. Archive or dedupe Phase 0 multi-horizon rows first.',
      duplicate_group_count;
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_ml_predictions_display_horizon_source_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ml_predictions_beach_predicted_at_unique
  ON public.ml_predictions_log (beach_id, predicted_at);

DROP INDEX IF EXISTS public.idx_ml_predictions_horizon_bucket_observed;

NOTIFY pgrst, 'reload schema';

COMMIT;
