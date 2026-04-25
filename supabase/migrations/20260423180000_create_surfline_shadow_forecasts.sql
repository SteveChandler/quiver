-- Shadow-capture Surfline's public wave forecast so we can compare MAE
-- vs our OM/NOAA forecasts against IOOS buoy ground truth.
BEGIN;

CREATE TABLE IF NOT EXISTS surfline_shadow_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id UUID NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
  forecast_ts TIMESTAMPTZ NOT NULL,

  -- Surfline wave height bounds, converted to METERS at ingest
  wave_height_min_m NUMERIC(4,2),
  wave_height_max_m NUMERIC(4,2),

  -- Source traceability
  surfline_spot_id TEXT NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_surfline_beach_forecast_ts UNIQUE (beach_id, forecast_ts)
);

CREATE INDEX idx_surfline_shadow_beach_ts
  ON surfline_shadow_forecasts(beach_id, forecast_ts DESC);

-- RLS: Public read, service role write
ALTER TABLE surfline_shadow_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY surfline_shadow_select_all
  ON surfline_shadow_forecasts FOR SELECT USING (true);

CREATE POLICY surfline_shadow_service_role_insert
  ON surfline_shadow_forecasts FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY surfline_shadow_service_role_update
  ON surfline_shadow_forecasts FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY surfline_shadow_service_role_delete
  ON surfline_shadow_forecasts FOR DELETE
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMIT;
