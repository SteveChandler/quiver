-- Log ML predictions for monitoring and ground truth matching
BEGIN;

CREATE TABLE IF NOT EXISTS ml_predictions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id UUID NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
  predicted_at TIMESTAMPTZ NOT NULL,

  -- Inputs
  raw_forecast_m NUMERIC(4,2),
  wave_period_s NUMERIC(4,1),
  wave_direction_deg NUMERIC(5,1),
  wind_speed_ms NUMERIC(4,1),
  wind_direction_deg NUMERIC(5,1),

  -- Outputs
  corrected_forecast_m NUMERIC(4,2),
  bias_applied_m NUMERIC(4,2),
  model_version TEXT NOT NULL,

  -- Ground truth (filled when observation arrives)
  observed_m NUMERIC(4,2),
  raw_error_m NUMERIC(4,2),
  corrected_error_m NUMERIC(4,2),

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ml_predictions_beach_ts
  ON ml_predictions_log(beach_id, predicted_at DESC);

CREATE INDEX idx_ml_predictions_pending_observation
  ON ml_predictions_log(predicted_at)
  WHERE observed_m IS NULL;

-- RLS: Service role only (cron jobs)
ALTER TABLE ml_predictions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY ml_predictions_service_role
  ON ml_predictions_log FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMIT;
