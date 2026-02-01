-- Migration: Create ML Model Registry and Drift Detection
-- Part of ML Rolling Pipeline (see docs/plans/2026-02-01-ml-rolling-pipeline-design.md)
--
-- Purpose:
-- - Track model versions, training metadata, and performance metrics
-- - Enable automated drift detection and retraining
-- - Support model rollback and production monitoring
--
-- Components:
-- 1. ml_model_registry table - stores model lifecycle data
-- 2. check_ml_drift() function - detects performance degradation
-- 3. RLS policies - service_role only access (like ml_predictions_log)

BEGIN;

-- =============================================================================
-- TABLE: ml_model_registry
-- =============================================================================
-- Tracks the lifecycle of ML models from training through production deployment

CREATE TABLE IF NOT EXISTS public.ml_model_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT UNIQUE NOT NULL, -- e.g., 'v3.20260202'

  -- Training metadata
  training_window_days INT NOT NULL,
  training_samples INT NOT NULL,
  training_started_at TIMESTAMPTZ,
  training_completed_at TIMESTAMPTZ,

  -- Validation metrics (from holdout set)
  holdout_improvement_pct NUMERIC(5,2), -- e.g., 52.3% (allows up to 999.99%)
  holdout_raw_mae NUMERIC(5,3),         -- e.g., 0.850m
  holdout_corrected_mae NUMERIC(5,3),   -- e.g., 0.420m

  -- Production metrics (filled after deployment)
  deployed_at TIMESTAMPTZ,
  production_improvement_pct NUMERIC(5,2), -- Real-world performance

  -- Lifecycle status
  status TEXT NOT NULL DEFAULT 'training'
    CHECK (status IN ('training', 'validated', 'deployed', 'rolled_back', 'failed')),
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying deployed models
CREATE INDEX idx_ml_model_registry_status_deployed
  ON public.ml_model_registry(deployed_at DESC)
  WHERE status = 'deployed';

-- Index for looking up current version
CREATE INDEX idx_ml_model_registry_version
  ON public.ml_model_registry(version);

COMMENT ON TABLE public.ml_model_registry IS
  'Tracks ML model versions, training metadata, validation metrics, and production performance. Used for model lifecycle management and rollback.';

COMMENT ON COLUMN public.ml_model_registry.version IS
  'Model version string (e.g., v3.20260202). Must be unique.';

COMMENT ON COLUMN public.ml_model_registry.status IS
  'Lifecycle status: training (in progress), validated (passed gates), deployed (active in production), rolled_back (reverted due to poor performance), failed (training or validation failed)';

COMMENT ON COLUMN public.ml_model_registry.training_window_days IS
  'Number of days of training data used (max 365)';

COMMENT ON COLUMN public.ml_model_registry.holdout_improvement_pct IS
  'Percentage of predictions improved on holdout set (must be >50% to deploy)';

COMMENT ON COLUMN public.ml_model_registry.production_improvement_pct IS
  'Actual improvement percentage in production (calculated from ml_predictions_log)';

-- =============================================================================
-- FUNCTION: check_ml_drift()
-- =============================================================================
-- Detects model performance degradation requiring emergency retrain
--
-- Returns TRUE if:
-- - Current week improvement < 40% (absolute floor)
-- - Current week MAE degraded by >20% vs previous week
--
-- Note: get_ml_weekly_metrics() doesn't currently return mae_degraded_pct,
-- so we calculate degradation by comparing this week's corrected_error_m
-- to previous week's corrected_error_m for the same model version.

CREATE OR REPLACE FUNCTION public.check_ml_drift()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_improvement NUMERIC;
  v_current_mae NUMERIC;
  v_previous_mae NUMERIC;
  v_mae_degradation_pct NUMERIC;
  v_current_model_version TEXT;
BEGIN
  -- Get current week metrics
  SELECT
    pct_improved,
    avg_corrected_error_m,
    model_version
  INTO
    v_current_improvement,
    v_current_mae,
    v_current_model_version
  FROM get_ml_weekly_metrics()
  LIMIT 1;

  -- If no data, no drift
  IF v_current_improvement IS NULL THEN
    RETURN false;
  END IF;

  -- Check absolute floor: improvement < 40%
  IF v_current_improvement < 40 THEN
    RETURN true;
  END IF;

  -- Get previous week MAE for the same model version
  SELECT
    ROUND(AVG(corrected_error_m)::numeric, 3)
  INTO v_previous_mae
  FROM ml_predictions_log
  WHERE model_version = v_current_model_version
    AND predicted_at > now() - interval '14 days'
    AND predicted_at <= now() - interval '7 days'
    AND observed_m IS NOT NULL;

  -- If we have previous week data, check for degradation
  IF v_previous_mae IS NOT NULL AND v_previous_mae > 0 THEN
    v_mae_degradation_pct := 100.0 * (v_current_mae - v_previous_mae) / v_previous_mae;

    -- Check relative degradation: >20% worse than previous week
    IF v_mae_degradation_pct > 20 THEN
      RETURN true;
    END IF;
  END IF;

  -- No drift detected
  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.check_ml_drift IS
  'Detects ML model drift. Returns true if current week improvement <40% OR MAE degraded >20% vs previous week. Used by automated retraining pipeline.';

-- =============================================================================
-- RLS POLICIES
-- =============================================================================
-- Service role only access (matches ml_predictions_log security model)

ALTER TABLE public.ml_model_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY ml_model_registry_service_role
  ON public.ml_model_registry FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON POLICY ml_model_registry_service_role ON public.ml_model_registry IS
  'Only service_role can access model registry. Used by cron jobs and retrain pipeline.';

-- Grant execute permission to service_role for drift check function
GRANT EXECUTE ON FUNCTION public.check_ml_drift TO service_role;

-- =============================================================================
-- HELPER FUNCTION: get_current_production_model()
-- =============================================================================
-- Returns the currently deployed model version
-- Useful for monitoring and API endpoints

CREATE OR REPLACE FUNCTION public.get_current_production_model()
RETURNS TABLE (
  version TEXT,
  deployed_at TIMESTAMPTZ,
  production_improvement_pct NUMERIC,
  training_samples INT,
  holdout_improvement_pct NUMERIC
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    version,
    deployed_at,
    production_improvement_pct,
    training_samples,
    holdout_improvement_pct
  FROM ml_model_registry
  WHERE status = 'deployed'
  ORDER BY deployed_at DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_current_production_model IS
  'Returns currently deployed model version and metrics. Used by /ml-stats endpoint.';

GRANT EXECUTE ON FUNCTION public.get_current_production_model TO service_role;

-- =============================================================================
-- TRIGGER: Update updated_at timestamp
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_ml_model_registry_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ml_model_registry_updated_at
  BEFORE UPDATE ON public.ml_model_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ml_model_registry_updated_at();

COMMIT;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS
-- =============================================================================
-- To rollback this migration, run:
--
-- BEGIN;
-- DROP TRIGGER IF EXISTS ml_model_registry_updated_at ON public.ml_model_registry;
-- DROP FUNCTION IF EXISTS public.update_ml_model_registry_updated_at();
-- DROP FUNCTION IF EXISTS public.get_current_production_model();
-- DROP FUNCTION IF EXISTS public.check_ml_drift();
-- DROP TABLE IF EXISTS public.ml_model_registry CASCADE;
-- COMMIT;
