-- Add Open-Meteo marine forecast columns to ml_predictions_log.
-- These capture the raw Open-Meteo values at prediction time so we can
-- compare them against NOAA sources and use them as ML features.
-- NULL means Open-Meteo data was unavailable for that prediction.

BEGIN;

ALTER TABLE public.ml_predictions_log
  ADD COLUMN IF NOT EXISTS wave_height_om real;

ALTER TABLE public.ml_predictions_log
  ADD COLUMN IF NOT EXISTS wave_period_om real;

ALTER TABLE public.ml_predictions_log
  ADD COLUMN IF NOT EXISTS wave_direction_om real;

ALTER TABLE public.ml_predictions_log
  ADD COLUMN IF NOT EXISTS swell_height_om real;

ALTER TABLE public.ml_predictions_log
  ADD COLUMN IF NOT EXISTS swell_period_om real;

ALTER TABLE public.ml_predictions_log
  ADD COLUMN IF NOT EXISTS swell_direction_om real;

ALTER TABLE public.ml_predictions_log
  ADD COLUMN IF NOT EXISTS wind_wave_height_om real;

COMMENT ON COLUMN public.ml_predictions_log.wave_height_om IS
  'Open-Meteo combined significant wave height (meters) at prediction time';

COMMENT ON COLUMN public.ml_predictions_log.wave_period_om IS
  'Open-Meteo dominant wave period (seconds) at prediction time';

COMMENT ON COLUMN public.ml_predictions_log.wave_direction_om IS
  'Open-Meteo dominant wave direction (degrees true) at prediction time';

COMMENT ON COLUMN public.ml_predictions_log.swell_height_om IS
  'Open-Meteo primary swell height (meters) at prediction time';

COMMENT ON COLUMN public.ml_predictions_log.swell_period_om IS
  'Open-Meteo primary swell period (seconds) at prediction time';

COMMENT ON COLUMN public.ml_predictions_log.swell_direction_om IS
  'Open-Meteo primary swell direction (degrees true) at prediction time';

COMMENT ON COLUMN public.ml_predictions_log.wind_wave_height_om IS
  'Open-Meteo wind wave height (meters) at prediction time';

COMMIT;
