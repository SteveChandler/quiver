-- Backfilled from remote supabase_migrations.schema_migrations on 2026-04-08
-- to reconcile drift from a parallel branch that applied directly to prod.
-- This migration was already applied to prod on 2026-04-08 17:52:43 UTC.

BEGIN;

-- Add training_diagnostics column to ml_model_registry
-- Stores feature importances, bucket pass/fail, exclude_wind flag, and other
-- metadata from the retrain pipeline. Currently this data is only written to
-- Fly logs (short retention) and is lost between sessions, making post-mortems
-- impossible. Persisting it unblocks audits of feature importance drift,
-- wind-enable/disable history, and bucket gate failures.
--
-- See: seaside/training.py:344 (training_diagnostics dict construction)
-- See: seaside/crons/retrain.py STEP 4 (registry update that writes this column)

ALTER TABLE public.ml_model_registry
  ADD COLUMN IF NOT EXISTS training_diagnostics JSONB;

COMMENT ON COLUMN public.ml_model_registry.training_diagnostics IS
  'Training-time diagnostics: feature_importances, exclude_wind, bucket gate results, etc. Written by seaside/crons/retrain.py step 4 from the TrainResponse.training_diagnostics field.';

-- GIN index for feature-importance lookups
-- (e.g. "show models where wind_speed importance > 0.05")
CREATE INDEX IF NOT EXISTS idx_ml_model_registry_diagnostics
  ON public.ml_model_registry USING gin (training_diagnostics);

COMMIT;
