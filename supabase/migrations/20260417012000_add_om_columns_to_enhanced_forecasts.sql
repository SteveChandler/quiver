BEGIN;

-- Add Open-Meteo wave forecast columns to enhanced_forecasts so OM data
-- persists alongside NOAA on the same (beach_id, forecast_at) row.
-- A second row per source would collide with the existing UNIQUE(beach_id,
-- forecast_at) constraint and changing that constraint would require auditing
-- 7+ downstream consumers. All columns are nullable and populated by new
-- ingestion code -- no backfill, no index (covered by existing
-- (beach_id, forecast_at) index). Names mirror ml_predictions_log so
-- downstream code can map 1:1.
ALTER TABLE enhanced_forecasts
  ADD COLUMN wave_height_om      real,
  ADD COLUMN wave_period_om      real,
  ADD COLUMN wave_direction_om   real,
  ADD COLUMN swell_height_om     real,
  ADD COLUMN swell_period_om     real,
  ADD COLUMN swell_direction_om  real,
  ADD COLUMN wind_wave_height_om real,
  ADD COLUMN om_fetched_at       timestamptz;

COMMIT;
