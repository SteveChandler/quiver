-- Store ML-corrected forecasts for fast app reads
BEGIN;

CREATE TABLE IF NOT EXISTS corrected_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id UUID NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
  forecast_ts TIMESTAMPTZ NOT NULL,
  valid_time_utc TIMESTAMPTZ NOT NULL, -- Explicit UTC for frontend

  -- Original forecast
  raw_height_m NUMERIC(4,2),

  -- ML correction
  corrected_height_m NUMERIC(4,2),
  bias_applied_m NUMERIC(4,2),
  model_version TEXT NOT NULL,

  -- Metadata
  corrected_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_beach_forecast_ts UNIQUE (beach_id, forecast_ts)
);

CREATE INDEX idx_corrected_forecasts_beach_ts
  ON corrected_forecasts(beach_id, forecast_ts DESC);

-- RLS: Public read, service role write
ALTER TABLE corrected_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY corrected_forecasts_select_all
  ON corrected_forecasts FOR SELECT USING (true);

CREATE POLICY corrected_forecasts_service_role_write
  ON corrected_forecasts FOR INSERT
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY corrected_forecasts_service_role_update
  ON corrected_forecasts FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMIT;
