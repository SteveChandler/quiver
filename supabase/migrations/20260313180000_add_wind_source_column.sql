BEGIN;

-- Track which service wrote the wind data so higher-priority sources aren't overwritten
ALTER TABLE enhanced_forecasts
  ADD COLUMN IF NOT EXISTS wind_source TEXT;

-- Index for the wind cron's update query (beach + time range + source check)
CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_wind_update
  ON enhanced_forecasts (beach_id, forecast_at)
  WHERE wind_source IS NULL OR wind_source NOT IN ('HRRR', 'NWS');

COMMENT ON COLUMN enhanced_forecasts.wind_source IS
  'Source that last wrote wind columns. Priority: HRRR > NWS > OPEN_METEO_WIND > null. '
  'Higher-priority sources are not overwritten by lower-priority ones.';

COMMIT;
