BEGIN;

-- Add raw Open-Meteo wave height passthrough as the third shadow competitor
-- alongside corrected_forecast_m (v3 ML-corrected) and candidate_corrected_m
-- (future v4 candidate). Enables three-way evaluation of whether the ML
-- bias-correction layer adds value over the raw OM baseline. Nullable, no
-- default, no backfill -- existing writers leave it NULL; Seaside
-- correct_forecasts.py will populate on new predictions.
ALTER TABLE ml_predictions_log
  ADD COLUMN om_passthrough_m real;

COMMIT;
