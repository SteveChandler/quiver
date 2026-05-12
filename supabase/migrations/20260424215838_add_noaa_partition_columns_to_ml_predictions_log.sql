-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

BEGIN;

ALTER TABLE ml_predictions_log
  ADD COLUMN IF NOT EXISTS noaa_swell_1_height_m     real,
  ADD COLUMN IF NOT EXISTS noaa_swell_1_period_s     real,
  ADD COLUMN IF NOT EXISTS noaa_swell_1_direction_deg real,
  ADD COLUMN IF NOT EXISTS noaa_swell_2_height_m     real,
  ADD COLUMN IF NOT EXISTS noaa_swell_2_period_s     real,
  ADD COLUMN IF NOT EXISTS noaa_swell_2_direction_deg real,
  ADD COLUMN IF NOT EXISTS noaa_wind_wave_height_m   real,
  ADD COLUMN IF NOT EXISTS noaa_wind_wave_period_s   real,
  ADD COLUMN IF NOT EXISTS noaa_wind_wave_direction_deg real;

COMMENT ON COLUMN ml_predictions_log.noaa_swell_1_height_m IS 'NOAA primary swell partition height (parsed from enhanced_forecasts.swell_1_height, ft->m).';
COMMENT ON COLUMN ml_predictions_log.noaa_swell_1_period_s IS 'NOAA primary swell partition period in seconds.';
COMMENT ON COLUMN ml_predictions_log.noaa_swell_1_direction_deg IS 'NOAA primary swell partition direction in degrees (0-360, compass-to-deg converted).';
COMMENT ON COLUMN ml_predictions_log.noaa_wind_wave_height_m IS 'NOAA wind-wave partition height. Critical for <0.5m bucket discrimination - short-period wind chop vs long-period groundswell at same total height.';

COMMIT;
